package com.auto366.flipbook;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.DocumentsContract;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.auto366.mobile.MainActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * flipbook 目录扫描插件（Capacitor 版）。
 *
 * 相比 Cordova 版的性能优化：
 * 1. 新增 listTree：一次桥接调用返回整棵子树（含文件大小），替代原来每秒轮询时
 *    "每个子目录一次 listFiles + 递归求大小" 的 N 次桥接往返。
 * 2. clearDirectory 非 SAF 路径改为迭代式删除（显式栈，无递归开销），并统计删除数量与耗时。
 * 3. SAF 路径全面改用 DocumentsContract 直接构造 document URI（document id 拼接），
 *    读文件/删目录不再走 DocumentFile.findFile —— 原来 findFile 每层都要整目录查询，
 *    复杂度 O(层数 x 目录项)，现在读文件零查询、删目录每层仅一次 children 枚举。
 * 4. 大幅精简逐文件日志（日志是原先慢路径的主要开销之一）。
 */
@CapacitorPlugin(name = "FlipbookScanner")
public class FlipbookScannerPlugin extends Plugin {

    private static final String TAG = "FlipbookScanner";
    private static final String ZERO_WIDTH_SPACE = "\u200b";
    private static final String MIME_DIR = DocumentsContract.Document.MIME_TYPE_DIR;
    private static final String[] DOC_PROJECTION = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED
    };
    private static final int COL_DOC_ID = 0;
    private static final int COL_NAME = 1;
    private static final int COL_MIME = 2;
    private static final int COL_SIZE = 3;
    private static final int COL_MODIFIED = 4;

    private static final ExecutorService IO_EXECUTOR = Executors.newSingleThreadExecutor();

    private volatile boolean safMode = false;
    private volatile boolean useZeroWidth = true;
    private volatile String safTreeUri = "";

    private interface IoWork {
        void run(PluginCall call) throws Exception;
    }

    private void io(final PluginCall call, final IoWork work) {
        IO_EXECUTOR.execute(() -> {
            try {
                work.run(call);
            } catch (Throwable t) {
                Log.e(TAG, "io error: " + t.getMessage());
                call.reject(t.getMessage());
            }
        });
    }

    // ------------------------------------------------------------------
    // 基础工具
    // ------------------------------------------------------------------

    private String clean(String s) {
        return s == null ? "" : s.replace(ZERO_WIDTH_SPACE, "");
    }

    private String bypassPath(String originalPath) {
        String p = clean(originalPath);
        if (!useZeroWidth) {
            return p;
        }
        if (p.contains("/Android/" + ZERO_WIDTH_SPACE + "data")) {
            return p;
        }
        return p.replace("/Android/data", "/Android/" + ZERO_WIDTH_SPACE + "data");
    }

    private static String joinPath(String parent, String child) {
        if (parent.endsWith("/")) {
            return parent + child;
        }
        return parent + "/" + child;
    }

    // ------------------------------------------------------------------
    // 权限
    // ------------------------------------------------------------------

    @PluginMethod
    public void checkPermission(final PluginCall call) {
        io(call, c -> {
            boolean hasPermission;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                hasPermission = Environment.isExternalStorageManager();
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                hasPermission = getContext().checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE)
                        == PackageManager.PERMISSION_GRANTED;
            } else {
                hasPermission = true;
            }
            JSObject result = new JSObject();
            result.put("hasPermission", hasPermission);
            c.resolve(result);
        });
    }

    @PluginMethod
    public void openAllFilesAccessSettings(final PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + activity.getPackageName()));
                suppressAutoPip();
                activity.startActivity(intent);
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    // ------------------------------------------------------------------
    // 列目录 / 目录树
    // ------------------------------------------------------------------

    @PluginMethod
    public void listFiles(final PluginCall call) {
        final String path = clean(call.getString("path", ""));
        io(call, c -> {
            JSONArray entries;
            if (safMode) {
                entries = safListEntries(path);
            } else {
                entries = nativeListEntries(bypassPath(path));
            }
            JSObject result = new JSObject();
            result.put("entries", entries);
            c.resolve(result);
        });
    }

    /**
     * 一次调用返回整棵目录树。节点结构：
     * { name, path, isDirectory, isFile, size, lastModified, children: [...] }
     */
    @PluginMethod
    public void listTree(final PluginCall call) {
        final String path = clean(call.getString("path", ""));
        final int maxDepth = call.getInt("maxDepth", 12);
        io(call, c -> {
            JSONObject root;
            if (safMode) {
                root = safBuildTree(path, maxDepth);
            } else {
                root = nativeBuildTree(path, maxDepth);
            }
            JSObject result = new JSObject();
            result.put("root", root);
            c.resolve(result);
        });
    }

    private JSONArray nativeListEntries(String actualPath) throws JSONException {
        JSONArray arr = new JSONArray();
        File dir = new File(actualPath);
        if (!dir.exists() || !dir.isDirectory()) {
            return arr;
        }
        File[] files = dir.listFiles();
        if (files == null) {
            return arr;
        }
        for (File file : files) {
            JSONObject entry = new JSONObject();
            entry.put("name", clean(file.getName()));
            entry.put("isDirectory", file.isDirectory());
            entry.put("isFile", file.isFile());
            entry.put("size", file.length());
            entry.put("lastModified", file.lastModified());
            entry.put("path", clean(file.getAbsolutePath()));
            arr.put(entry);
        }
        return arr;
    }

    private JSONObject nativeBuildTree(String path, int maxDepth) throws JSONException {
        File dir = new File(bypassPath(path));
        if (!dir.exists() || !dir.isDirectory()) {
            JSONObject missing = new JSONObject();
            missing.put("name", clean(dir.getName()));
            missing.put("path", clean(path));
            missing.put("isDirectory", false);
            missing.put("isFile", false);
            missing.put("size", 0L);
            missing.put("lastModified", 0L);
            missing.put("children", new JSONArray());
            return missing;
        }
        return nativeTreeNode(dir, clean(path), 0, maxDepth);
    }

    private JSONObject nativeTreeNode(File dir, String displayPath, int depth, int maxDepth) throws JSONException {
        JSONObject node = new JSONObject();
        node.put("name", clean(dir.getName()));
        node.put("path", displayPath);
        node.put("isDirectory", true);
        node.put("isFile", false);
        node.put("size", dir.length());
        node.put("lastModified", dir.lastModified());
        JSONArray children = new JSONArray();
        if (depth < maxDepth) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    String childDisplay = joinPath(displayPath, clean(f.getName()));
                    if (f.isDirectory()) {
                        children.put(nativeTreeNode(f, childDisplay, depth + 1, maxDepth));
                    } else {
                        JSONObject leaf = new JSONObject();
                        leaf.put("name", clean(f.getName()));
                        leaf.put("path", childDisplay);
                        leaf.put("isDirectory", false);
                        leaf.put("isFile", true);
                        leaf.put("size", f.length());
                        leaf.put("lastModified", f.lastModified());
                        children.put(leaf);
                    }
                }
            }
        }
        node.put("children", children);
        return node;
    }

    // ------------------------------------------------------------------
    // 读文件
    // ------------------------------------------------------------------

    @PluginMethod
    public void readFile(final PluginCall call) {
        final String path = clean(call.getString("path", ""));
        io(call, c -> {
            String content;
            long size;
            if (safMode) {
                content = safReadText(path);
                if (content == null) {
                    c.reject("SAF read failed: " + path);
                    return;
                }
                size = content.length();
            } else {
                File file = new File(bypassPath(path));
                if (!file.exists() || !file.isFile()) {
                    c.reject("File does not exist: " + path);
                    return;
                }
                StringBuilder sb = new StringBuilder((int) Math.min(file.length() + 16, Integer.MAX_VALUE - 8));
                BufferedReader reader = new BufferedReader(new FileReader(file));
                char[] buf = new char[16384];
                int n;
                while ((n = reader.read(buf)) != -1) {
                    sb.append(buf, 0, n);
                }
                reader.close();
                content = sb.toString();
                size = file.length();
            }
            JSObject result = new JSObject();
            result.put("content", content);
            result.put("size", size);
            result.put("path", path);
            c.resolve(result);
        });
    }

    @PluginMethod
    public void readBinaryFile(final PluginCall call) {
        final String path = clean(call.getString("path", ""));
        io(call, c -> {
            byte[] data;
            if (safMode) {
                data = safReadBinary(path);
                if (data == null) {
                    c.reject("SAF read failed: " + path);
                    return;
                }
            } else {
                File file = new File(bypassPath(path));
                if (!file.exists() || !file.isFile()) {
                    c.reject("File does not exist: " + path);
                    return;
                }
                FileInputStream fis = new FileInputStream(file);
                ByteArrayOutputStream bos = new ByteArrayOutputStream((int) Math.min(file.length(), 1 << 24));
                byte[] buf = new byte[32768];
                int n;
                while ((n = fis.read(buf)) != -1) {
                    bos.write(buf, 0, n);
                }
                fis.close();
                data = bos.toByteArray();
            }
            JSObject result = new JSObject();
            result.put("base64", Base64.encodeToString(data, Base64.NO_WRAP));
            result.put("size", data.length);
            result.put("path", path);
            c.resolve(result);
        });
    }

    // ------------------------------------------------------------------
    // 清空目录 / 创建目录
    // ------------------------------------------------------------------

    @PluginMethod
    public void clearDirectory(final PluginCall call) {
        final String path = clean(call.getString("path", ""));
        io(call, c -> {
            long started = SystemClock.elapsedRealtime();
            long deleted;
            boolean success;
            if (safMode) {
                deleted = safClearContents(path);
                success = deleted >= 0;
            } else {
                File dir = new File(bypassPath(path));
                if (!dir.exists() || !dir.isDirectory()) {
                    c.reject("Directory does not exist: " + path);
                    return;
                }
                deleted = nativeClearContents(dir);
                success = true;
            }
            long elapsed = SystemClock.elapsedRealtime() - started;
            Log.i(TAG, "clearDirectory " + path + ": deleted=" + deleted + ", elapsed=" + elapsed + "ms");
            JSObject result = new JSObject();
            result.put("success", success);
            result.put("deletedCount", deleted);
            result.put("elapsedMs", elapsed);
            c.resolve(result);
        });
    }

    /**
     * 迭代式删除（两栈法）：第一遍删掉所有文件并按"叶子在前"的顺序收集目录，
     * 第二遍倒序删除已空的目录。避免深递归栈开销。
     */
    private long nativeClearContents(File rootDir) {
        Deque<File> pendingDirs = new ArrayDeque<>();
        Deque<File> orderedDirs = new ArrayDeque<>();
        long deleted = 0;
        pendingDirs.push(rootDir);
        while (!pendingDirs.isEmpty()) {
            File dir = pendingDirs.pop();
            orderedDirs.push(dir);
            File[] children = dir.listFiles();
            if (children == null) {
                continue;
            }
            for (File f : children) {
                if (f.isDirectory()) {
                    pendingDirs.push(f);
                } else if (f.delete()) {
                    deleted++;
                }
            }
        }
        while (!orderedDirs.isEmpty()) {
            File dir = orderedDirs.pop();
            if (dir.equals(rootDir)) {
                continue;
            }
            if (dir.delete()) {
                deleted++;
            }
        }
        return deleted;
    }

    @PluginMethod
    public void ensureDirectory(final PluginCall call) {
        final String path = clean(call.getString("path", ""));
        io(call, c -> {
            boolean exists;
            if (safMode) {
                exists = safEnsureDir(path);
            } else {
                File dir = new File(bypassPath(path));
                if (!dir.exists()) {
                    dir.mkdirs();
                }
                exists = dir.exists() && dir.isDirectory();
            }
            JSObject result = new JSObject();
            result.put("exists", exists);
            result.put("path", path);
            c.resolve(result);
        });
    }

    // ------------------------------------------------------------------
    // 设置项（保持与旧版 API 一致）
    // ------------------------------------------------------------------

    @PluginMethod
    public void setSafMode(final PluginCall call) {
        safMode = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        Log.i(TAG, "safMode set to: " + safMode);
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setUseZeroWidth(final PluginCall call) {
        useZeroWidth = call.getBoolean("enabled", true);
        Log.i(TAG, "useZeroWidth set to: " + useZeroWidth);
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void setSafTreeUri(final PluginCall call) {
        safTreeUri = call.getString("uri", "");
        Log.i(TAG, "safTreeUri set to: " + safTreeUri);
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    // ------------------------------------------------------------------
    // SAF 目录选择器
    // ------------------------------------------------------------------

    @PluginMethod
    public void requestSafTree(final PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try {
            Uri initial = DocumentsContract.buildDocumentUri(
                    "com.android.externalstorage.documents", "primary:Android/data");
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, initial);
        } catch (Exception ignored) {
        }
        suppressAutoPip();
        startActivityForResult(call, intent, "onSafTreeResult");
    }

    @ActivityCallback
    private void onSafTreeResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        Intent data = result != null ? result.getData() : null;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            call.resolve(ret);
            return;
        }
        Uri treeUri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception e) {
            Log.w(TAG, "takePersistableUriPermission failed: " + e.getMessage());
        }
        safTreeUri = treeUri.toString();
        Log.i(TAG, "SAF tree URI saved: " + safTreeUri);
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("uri", safTreeUri);
        call.resolve(ret);
    }

    // ------------------------------------------------------------------
    // 画中画 / 外部浏览器
    // ------------------------------------------------------------------

    /** 打开外部界面前调用，防止 onPause 兜底逻辑误把应用送进画中画 */
    private void suppressAutoPip() {
        MainActivity main = MainActivity.getInstance();
        if (main != null) {
            main.setSuppressAutoPip(true);
        }
    }

    @PluginMethod
    public void enterPipMode(final PluginCall call) {
        Log.i(TAG, "plugin.enterPipMode invoked from JS", new Throwable("who-called"));
        final MainActivity main = MainActivity.getInstance();
        if (main == null) {
            call.reject("MainActivity unavailable");
            return;
        }
        main.runOnUiThread(main::enterPipMode);
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    /** 同步监听状态到原生层，用于上划手势自动进入画中画的判定。 */
    @PluginMethod
    public void setAppState(final PluginCall call) {
        final Boolean monitoring = call.getBoolean("monitoring");
        final Boolean autoPip = call.getBoolean("autoPip");
        final MainActivity main = MainActivity.getInstance();
        if (main != null) {
            main.runOnUiThread(() -> main.setPipAppState(monitoring, autoPip));
        }
        call.resolve();
    }

    @PluginMethod
    public void openUrl(final PluginCall call) {
        final String url = call.getString("url", "");
        if (url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            suppressAutoPip();
            activity.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    // ==================================================================
    // SAF 实现（DocumentsContract 直连，绕过 DocumentFile 的逐级查询）
    // ==================================================================

    private String safRelPath(String fullPath) {
        String p = clean(fullPath);
        String prefix = "/storage/emulated/0/";
        if (p.startsWith(prefix)) {
            p = p.substring(prefix.length());
        }
        int idx = p.indexOf("Android/data/");
        if (idx >= 0) {
            return p.substring(idx + "Android/data/".length());
        }
        return p;
    }

    private String[] pathSegments(String rel) {
        List<String> parts = new ArrayList<>();
        for (String part : rel.split("/")) {
            if (!part.isEmpty()) {
                parts.add(part);
            }
        }
        return parts.toArray(new String[0]);
    }

    /** 直接用 document id 拼接构造 URI，不产生任何内容提供者查询 */
    private Uri safBuildTargetUri(String fullPath) {
        Uri tree = Uri.parse(safTreeUri);
        String docId = DocumentsContract.getTreeDocumentId(tree);
        StringBuilder sb = new StringBuilder(docId);
        for (String seg : pathSegments(safRelPath(fullPath))) {
            sb.append('/').append(seg);
        }
        return DocumentsContract.buildDocumentUriUsingTree(tree, sb.toString());
    }

    private Uri safChildDocsUri(String parentDocId) {
        return DocumentsContract.buildChildDocumentsUriUsingTree(Uri.parse(safTreeUri), parentDocId);
    }

    private Uri safDocUri(String docId) {
        return DocumentsContract.buildDocumentUriUsingTree(Uri.parse(safTreeUri), docId);
    }

    private String safTargetDocId(String fullPath) {
        String docId = DocumentsContract.getTreeDocumentId(Uri.parse(safTreeUri));
        for (String seg : pathSegments(safRelPath(fullPath))) {
            docId = docId + "/" + seg;
        }
        return docId;
    }

    private ContentResolver safResolver() {
        return getContext().getContentResolver();
    }

    /** 枚举某个 document id 下的所有子项（一次查询）。失败返回空列表。 */
    private List<JSONObject> safListChildren(String dirDocId) {
        List<JSONObject> out = new ArrayList<>();
        ContentResolver resolver = safResolver();
        try (Cursor c = resolver.query(safChildDocsUri(dirDocId), DOC_PROJECTION, null, null, null)) {
            if (c == null) {
                return out;
            }
            while (c.moveToNext()) {
                JSONObject item = new JSONObject();
                item.put("docId", c.getString(COL_DOC_ID));
                item.put("name", c.getString(COL_NAME));
                item.put("isDirectory", MIME_DIR.equals(c.getString(COL_MIME)));
                item.put("size", c.getLong(COL_SIZE));
                item.put("lastModified", c.getLong(COL_MODIFIED));
                out.add(item);
            }
        } catch (Exception e) {
            Log.e(TAG, "safListChildren error: " + e.getMessage());
        }
        return out;
    }

    private JSONArray safListEntries(String fullPath) throws JSONException {
        JSONArray arr = new JSONArray();
        try {
            String dirDocId = safTargetDocId(fullPath);
            String displayParent = fullPath.endsWith("/") ? fullPath : fullPath + "/";
            for (JSONObject item : safListChildren(dirDocId)) {
                JSONObject entry = new JSONObject();
                entry.put("name", item.getString("name"));
                entry.put("isDirectory", item.getBoolean("isDirectory"));
                entry.put("isFile", !item.getBoolean("isDirectory"));
                entry.put("size", item.getLong("size"));
                entry.put("lastModified", item.getLong("lastModified"));
                entry.put("path", displayParent + item.getString("name"));
                arr.put(entry);
            }
        } catch (Exception e) {
            Log.e(TAG, "safListEntries error: " + e.getMessage());
        }
        return arr;
    }

    private JSONObject safBuildTree(String fullPath, int maxDepth) throws JSONException {
        try {
            String dirDocId = safTargetDocId(fullPath);
            return safTreeNode(fullPath, dirDocId, 0, maxDepth);
        } catch (Exception e) {
            Log.e(TAG, "safBuildTree error: " + e.getMessage());
            JSONObject missing = new JSONObject();
            missing.put("name", clean(fullPath));
            missing.put("path", fullPath);
            missing.put("isDirectory", false);
            missing.put("isFile", false);
            missing.put("size", 0L);
            missing.put("lastModified", 0L);
            missing.put("children", new JSONArray());
            return missing;
        }
    }

    private JSONObject safTreeNode(String displayPath, String dirDocId, int depth, int maxDepth) throws JSONException {
        JSONObject node = new JSONObject();
        node.put("name", clean(displayPath.substring(displayPath.lastIndexOf('/') + 1)));
        node.put("path", displayPath);
        node.put("isDirectory", true);
        node.put("isFile", false);
        node.put("size", 0L);
        node.put("lastModified", 0L);
        JSONArray children = new JSONArray();
        if (depth < maxDepth) {
            String displayParent = displayPath.endsWith("/") ? displayPath : displayPath + "/";
            for (JSONObject item : safListChildren(dirDocId)) {
                String name = item.getString("name");
                String childDisplay = displayParent + name;
                if (item.getBoolean("isDirectory")) {
                    children.put(safTreeNode(childDisplay, item.getString("docId"), depth + 1, maxDepth));
                } else {
                    JSONObject leaf = new JSONObject();
                    leaf.put("name", name);
                    leaf.put("path", childDisplay);
                    leaf.put("isDirectory", false);
                    leaf.put("isFile", true);
                    leaf.put("size", item.getLong("size"));
                    leaf.put("lastModified", item.getLong("lastModified"));
                    children.put(leaf);
                }
            }
        }
        node.put("children", children);
        return node;
    }

    private InputStream safOpenStream(String fullPath) throws Exception {
        // 优先直连：拼接 document URI 直接打开，零查询
        try {
            InputStream is = safResolver().openInputStream(safBuildTargetUri(fullPath));
            if (is != null) {
                return is;
            }
        } catch (Exception e) {
            Log.w(TAG, "direct SAF open failed, falling back: " + e.getMessage());
        }
        // 兜底：极少数 ROM 对拼接 URI 校验严格时，退回 DocumentFile 逐级查找
        DocumentFile file = safFindDocumentFile(fullPath);
        if (file == null || !file.isFile()) {
            throw new Exception("File not found (SAF): " + fullPath);
        }
        return safResolver().openInputStream(file.getUri());
    }

    private String safReadText(String fullPath) {
        try (InputStream is = safOpenStream(fullPath)) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder sb = new StringBuilder();
            char[] buf = new char[16384];
            int n;
            while ((n = reader.read(buf)) != -1) {
                sb.append(buf, 0, n);
            }
            reader.close();
            return sb.toString();
        } catch (Exception e) {
            Log.e(TAG, "safReadText error: " + e.getMessage());
            return null;
        }
    }

    private byte[] safReadBinary(String fullPath) {
        try (InputStream is = safOpenStream(fullPath)) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] data = new byte[32768];
            int n;
            while ((n = is.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, n);
            }
            return buffer.toByteArray();
        } catch (Exception e) {
            Log.e(TAG, "safReadBinary error: " + e.getMessage());
            return null;
        }
    }

    /**
     * 迭代式 SAF 清空：自顶向下枚举 children（每层一次查询），先递归清空再删除。
     * 返回成功删除的条目数，出错返回 -1。
     */
    private long safClearContents(String fullPath) {
        try {
            String dirDocId = safTargetDocId(fullPath);
            return safDeleteChildrenRecursive(dirDocId);
        } catch (Exception e) {
            Log.e(TAG, "safClearContents error: " + e.getMessage());
            return -1;
        }
    }

    private long safDeleteChildrenRecursive(String dirDocId) {
        ContentResolver resolver = safResolver();
        long deleted = 0;
        List<JSONObject> children = safListChildren(dirDocId);
        for (JSONObject item : children) {
            try {
                String childId = item.getString("docId");
                if (item.getBoolean("isDirectory")) {
                    deleted += safDeleteChildrenRecursive(childId);
                }
                if (resolver.delete(safDocUri(childId), null, null) > 0) {
                    deleted++;
                }
            } catch (Exception e) {
                Log.w(TAG, "saf delete failed: " + e.getMessage());
            }
        }
        return deleted;
    }

    private boolean safEnsureDir(String fullPath) {
        try {
            DocumentFile treeDoc = DocumentFile.fromTreeUri(getContext(), Uri.parse(safTreeUri));
            if (treeDoc == null) {
                return false;
            }
            DocumentFile current = treeDoc;
            for (String part : pathSegments(safRelPath(fullPath))) {
                DocumentFile child = current.findFile(part);
                if (child == null) {
                    child = current.createDirectory(part);
                    if (child == null) {
                        Log.e(TAG, "Failed to create directory: " + part);
                        return false;
                    }
                } else if (!child.isDirectory()) {
                    Log.e(TAG, "Path exists but is not a directory: " + part);
                    return false;
                }
                current = child;
            }
            return true;
        } catch (Exception e) {
            Log.e(TAG, "safEnsureDir error: " + e.getMessage());
            return false;
        }
    }

    /** DocumentFile 逐级查找兜底（仅在直连 URI 打开失败时使用） */
    private DocumentFile safFindDocumentFile(String fullPath) {
        try {
            DocumentFile current = DocumentFile.fromTreeUri(getContext(), Uri.parse(safTreeUri));
            if (current == null) {
                return null;
            }
            for (String part : pathSegments(safRelPath(fullPath))) {
                current = current.findFile(part);
                if (current == null) {
                    return null;
                }
            }
            return current;
        } catch (Exception e) {
            return null;
        }
    }
}
