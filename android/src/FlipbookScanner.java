package com.auto366.flipbook;

import android.os.Build;
import android.os.Environment;
import android.util.Log;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.app.Activity;
import android.util.Base64;
import java.util.HashMap;
import java.util.Map;
import androidx.documentfile.provider.DocumentFile;

public class FlipbookScanner extends CordovaPlugin {

    private static final String TAG = "FlipbookScanner";
    private static final String ZERO_WIDTH_SPACE = "\u200b";
    private static final String ACTION_CHECK_PERMISSION = "checkPermission";
    private static final String ACTION_LIST_FILES = "listFiles";
    private static final String ACTION_READ_FILE = "readFile";
    private static final String ACTION_READ_BINARY = "readBinaryFile";
    private static final String ACTION_CLEAR_DIR = "clearDirectory";
    private static final String ACTION_ENSURE_DIR = "ensureDirectory";
    private static final String ACTION_OPEN_SETTINGS = "openAllFilesAccessSettings";
    private static final String ACTION_SET_SAF_MODE = "setSafMode";
    private static final String ACTION_SET_USE_ZERO_WIDTH = "setUseZeroWidth";
    private static final String ACTION_SET_SAF_URI = "setSafTreeUri";
    private static final String ACTION_REQUEST_SAF_TREE = "requestSafTree";

    private boolean safMode = false;
    private boolean useZeroWidth = true;
    private String safTreeUri = "";
    private CallbackContext safTreeCallbackContext = null;

    private Map<String, String> bypassPathCache = new HashMap<>();

    private String bypassPath(String originalPath) {
        if (!useZeroWidth) {
            return originalPath;
        }
        if (originalPath.contains("/Android/" + ZERO_WIDTH_SPACE + "data")) {
            return originalPath;
        }
        return originalPath.replace("/Android/data", "/Android/" + ZERO_WIDTH_SPACE + "data");
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        switch (action) {
            case ACTION_CHECK_PERMISSION:
                checkPermission(callbackContext);
                return true;
            case ACTION_LIST_FILES:
                listFiles(args.getString(0), callbackContext);
                return true;
            case ACTION_READ_FILE:
                readFile(args.getString(0), callbackContext);
                return true;
            case ACTION_READ_BINARY:
                readBinaryFile(args.getString(0), callbackContext);
                return true;
            case ACTION_CLEAR_DIR:
                clearDirectory(args.getString(0), callbackContext);
                return true;
            case ACTION_ENSURE_DIR:
                ensureDirectory(args.getString(0), callbackContext);
                return true;
            case ACTION_OPEN_SETTINGS:
                openAllFilesAccessSettings(callbackContext);
                return true;
            case ACTION_SET_SAF_MODE:
                setSafMode(args.optBoolean(0, false), callbackContext);
                return true;
            case ACTION_SET_USE_ZERO_WIDTH:
                setUseZeroWidth(args.optBoolean(0, true), callbackContext);
                return true;
            case ACTION_SET_SAF_URI:
                setSafTreeUri(args.optString(0, ""), callbackContext);
                return true;
            case ACTION_REQUEST_SAF_TREE:
                requestSafTree(callbackContext);
                return true;
        }
        return false;
    }

    private void checkPermission(CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            boolean hasPermission = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                hasPermission = Environment.isExternalStorageManager();
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                hasPermission = cordova.hasPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE);
            } else {
                hasPermission = true;
            }
            JSONObject result = new JSONObject();
            try {
                result.put("hasPermission", hasPermission);
                callbackContext.success(result);
            } catch (JSONException e) {
                callbackContext.error("JSON error: " + e.getMessage());
            }
        });
    }

    private void openAllFilesAccessSettings(CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            Activity activity = this.cordova.getActivity();
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
            intent.setData(Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(intent);
            try {
                JSONObject result = new JSONObject();
                result.put("success", true);
                callbackContext.success(result);
            } catch (JSONException e) {
                callbackContext.error("JSON error: " + e.getMessage());
            }
        });
    }

    private void listFiles(String path, CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                if (safMode) {
                    JSONArray files = listSafFiles(path);
                    callbackContext.success(files);
                    return;
                }
                String actualPath = bypassPath(path);
                File dir = new File(actualPath);
                Log.i(TAG, "Original path: " + path);
                Log.i(TAG, "Bypass path: " + actualPath);
                Log.i(TAG, "Exists: " + dir.exists());
                Log.i(TAG, "IsDirectory: " + dir.isDirectory());
                Log.i(TAG, "CanRead: " + dir.canRead());

                if (!dir.exists() || !dir.isDirectory()) {
                    callbackContext.error("Directory does not exist: " + path);
                    return;
                }

                File[] files = dir.listFiles();
                if (files == null) {
                    Log.w(TAG, "listFiles() returned null for: " + actualPath);
                    callbackContext.success(new JSONArray());
                    return;
                }
                Log.i(TAG, "Found " + files.length + " files");
                JSONArray result = new JSONArray();
                for (File file : files) {
                    try {
                        Log.i(TAG, "  File: " + file.getName() + " isDir=" + file.isDirectory());
                        JSONObject entry = new JSONObject();
                        entry.put("name", file.getName().replace(ZERO_WIDTH_SPACE, ""));
                        entry.put("isDirectory", file.isDirectory());
                        entry.put("isFile", file.isFile());
                        entry.put("size", file.length());
                        entry.put("lastModified", file.lastModified());
                        entry.put("path", file.getAbsolutePath().replace(ZERO_WIDTH_SPACE, ""));
                        result.put(entry);
                    } catch (JSONException e) {
                        Log.w(TAG, "JSON error for file: " + file.getName());
                    }
                }
                callbackContext.success(result);
            } catch (Exception e) {
                callbackContext.error("listFiles error: " + e.getMessage());
            }
        });
    }

    private void readFile(String path, CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                if (safMode) {
                    String content = readSafFile(path);
                    if (content != null) {
                        JSONObject result = new JSONObject();
                        result.put("content", content);
                        result.put("size", content.length());
                        callbackContext.success(result);
                    } else {
                        callbackContext.error("SAF read failed: " + path);
                    }
                    return;
                }
                String actualPath = bypassPath(path);
                File file = new File(actualPath);
                Log.i(TAG, "Read file original path: " + path);
                Log.i(TAG, "Read file bypass path: " + actualPath);
                Log.i(TAG, "Read file exists: " + file.exists());
                Log.i(TAG, "Read file isFile: " + file.isFile());
                if (!file.exists() || !file.isFile()) {
                    callbackContext.error("File does not exist: " + path);
                    return;
                }
                StringBuilder content = new StringBuilder();
                BufferedReader reader = new BufferedReader(new FileReader(file));
                String line;
                while ((line = reader.readLine()) != null) {
                    content.append(line).append("\n");
                }
                reader.close();
                String resultContent = content.toString();
                Log.i(TAG, "Read file content length: " + resultContent.length());
                if (resultContent.length() > 200) {
                    Log.i(TAG, "Read file content preview: " + resultContent.substring(0, 200));
                }
                JSONObject result = new JSONObject();
                result.put("content", resultContent);
                result.put("size", file.length());
                result.put("path", file.getAbsolutePath().replace(ZERO_WIDTH_SPACE, ""));
                callbackContext.success(result);
            } catch (IOException e) {
                Log.e(TAG, "Read file IO error: " + e.getMessage());
                callbackContext.error("Read error: " + e.getMessage());
            } catch (JSONException e) {
                callbackContext.error("JSON error: " + e.getMessage());
            }
        });
    }

    private void readBinaryFile(String path, CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                if (safMode) {
                    byte[] data = readSafBinary(path);
                    if (data != null) {
                        String base64 = Base64.encodeToString(data, Base64.NO_WRAP);
                        JSONObject result = new JSONObject();
                        result.put("base64", base64);
                        result.put("size", data.length);
                        callbackContext.success(result);
                    } else {
                        callbackContext.error("SAF read failed: " + path);
                    }
                    return;
                }
                String actualPath = bypassPath(path);
                File file = new File(actualPath);
                Log.i(TAG, "Read binary file: " + actualPath);
                if (!file.exists() || !file.isFile()) {
                    callbackContext.error("File does not exist: " + path);
                    return;
                }
                FileInputStream fis = new FileInputStream(file);
                byte[] data = new byte[(int) file.length()];
                fis.read(data);
                fis.close();
                String base64 = Base64.encodeToString(data, Base64.NO_WRAP);
                Log.i(TAG, "Read binary file size: " + data.length + ", base64 length: " + base64.length());
                JSONObject result = new JSONObject();
                result.put("base64", base64);
                result.put("size", file.length());
                result.put("path", file.getAbsolutePath().replace(ZERO_WIDTH_SPACE, ""));
                callbackContext.success(result);
            } catch (IOException e) {
                callbackContext.error("Read error: " + e.getMessage());
            } catch (JSONException e) {
                callbackContext.error("JSON error: " + e.getMessage());
            }
        });
    }

    private void clearDirectory(String path, CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                if (safMode) {
                    boolean success = deleteSafDir(path);
                    JSONObject result = new JSONObject();
                    result.put("success", success);
                    if (success) callbackContext.success(result);
                    else {
                        result.put("error", "Failed to clear directory");
                        callbackContext.error(result);
                    }
                    return;
                }
                String actualPath = bypassPath(path);
                File dir = new File(actualPath);
                if (!dir.exists() || !dir.isDirectory()) {
                    callbackContext.error("Directory does not exist: " + path);
                    return;
                }
                boolean success = deleteDirContents(dir);
                JSONObject result = new JSONObject();
                result.put("success", success);
                if (success) {
                    callbackContext.success(result);
                } else {
                    result.put("error", "Failed to clear directory");
                    callbackContext.error(result);
                }
            } catch (JSONException e) {
                callbackContext.error("JSON error: " + e.getMessage());
            }
        });
    }

    private void ensureDirectory(String path, CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            try {
                if (safMode) {
                    boolean success = ensureSafDir(path);
                    JSONObject result = new JSONObject();
                    result.put("success", success);
                    callbackContext.success(result);
                    return;
                }
                String actualPath = bypassPath(path);
                File dir = new File(actualPath);
                Log.i(TAG, "Ensure directory original path: " + path);
                Log.i(TAG, "Ensure directory bypass path: " + actualPath);

                if (!dir.exists()) {
                    boolean created = dir.mkdirs();
                    Log.i(TAG, "Directory created: " + created);
                }

                JSONObject result = new JSONObject();
                result.put("exists", dir.exists());
                result.put("path", dir.getAbsolutePath().replace(ZERO_WIDTH_SPACE, ""));
                callbackContext.success(result);
            } catch (JSONException e) {
                callbackContext.error("JSON error: " + e.getMessage());
            }
        });
    }

    private boolean deleteDirContents(File dir) {
        File[] files = dir.listFiles();
        boolean allSuccess = true;
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    if (!deleteDirContents(file) || !file.delete()) {
                        allSuccess = false;
                    }
                } else {
                    if (!file.delete()) {
                        allSuccess = false;
                    }
                }
            }
        }
        return allSuccess;
    }

    private void setSafMode(boolean saf, CallbackContext callbackContext) {
        safMode = saf;
        Log.i(TAG, "safMode set to: " + saf);
        try {
            JSONObject result = new JSONObject();
            result.put("success", true);
            callbackContext.success(result);
        } catch (JSONException e) {
            callbackContext.error("JSON error: " + e.getMessage());
        }
    }

    private void setUseZeroWidth(boolean use, CallbackContext callbackContext) {
        useZeroWidth = use;
        Log.i(TAG, "useZeroWidth set to: " + use);
        try {
            JSONObject result = new JSONObject();
            result.put("success", true);
            callbackContext.success(result);
        } catch (JSONException e) {
            callbackContext.error("JSON error: " + e.getMessage());
        }
    }

    private void setSafTreeUri(String uri, CallbackContext callbackContext) {
        safTreeUri = uri;
        Log.i(TAG, "safTreeUri set to: " + uri);
        try {
            JSONObject result = new JSONObject();
            result.put("success", true);
            callbackContext.success(result);
        } catch (JSONException e) {
            callbackContext.error("JSON error: " + e.getMessage());
        }
    }

    private void requestSafTree(CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
            Activity activity = this.cordova.getActivity();
            Uri uri = Uri.parse("content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fdata");
            DocumentFile documentFile = DocumentFile.fromTreeUri(activity, uri);
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
            if (documentFile != null) {
                intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, documentFile.getUri());
            }
            this.safTreeCallbackContext = callbackContext;
            this.cordova.startActivityForResult(this, intent, 100);
        });
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        if (requestCode == 100 && this.safTreeCallbackContext != null) {
            try {
                if (resultCode == Activity.RESULT_OK && intent != null) {
                    Uri treeUri = intent.getData();
                    if (treeUri != null) {
                        cordova.getActivity().getContentResolver().takePersistableUriPermission(
                            treeUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        );
                        safTreeUri = treeUri.toString();
                        Log.i(TAG, "SAF tree URI saved: " + safTreeUri);
                        JSONObject result = new JSONObject();
                        result.put("success", true);
                        result.put("uri", safTreeUri);
                        this.safTreeCallbackContext.success(result);
                    } else {
                        JSONObject result = new JSONObject();
                        result.put("success", false);
                        this.safTreeCallbackContext.success(result);
                    }
                } else {
                    JSONObject result = new JSONObject();
                    result.put("success", false);
                    this.safTreeCallbackContext.success(result);
                }
            } catch (Exception e) {
                Log.e(TAG, "onActivityResult error: " + e.getMessage());
                if (this.safTreeCallbackContext != null) {
                    this.safTreeCallbackContext.error(e.getMessage());
                }
            } finally {
                this.safTreeCallbackContext = null;
            }
        }
    }

    private JSONArray listSafFiles(String relativePath) {
        JSONArray files = new JSONArray();
        try {
            if (safTreeUri.isEmpty()) return files;
            
            Uri treeUriObj = Uri.parse(safTreeUri);
            DocumentFile treeDoc = DocumentFile.fromTreeUri(cordova.getActivity(), treeUriObj);
            if (treeDoc == null) return files;
            
            DocumentFile targetDir = treeDoc;
            if (!relativePath.isEmpty()) {
                String[] parts = relativePath.replace("/storage/emulated/0/", "").split("/");
                for (String part : parts) {
                    if (part.isEmpty()) continue;
                    DocumentFile child = targetDir.findFile(part);
                    if (child == null || !child.isDirectory()) return files;
                    targetDir = child;
                }
            }
            
            DocumentFile[] children = targetDir.listFiles();
            for (DocumentFile child : children) {
                JSONObject file = new JSONObject();
                file.put("name", child.getName());
                file.put("isDirectory", child.isDirectory());
                file.put("isFile", child.isFile());
                file.put("size", child.length());
                files.put(file);
            }
        } catch (Exception e) {
            Log.e(TAG, "listSafFiles error: " + e.getMessage());
        }
        return files;
    }

    private String readSafFile(String relativePath) {
        try {
            if (safTreeUri.isEmpty()) return null;
            
            DocumentFile file = findSafFile(relativePath);
            if (file == null || !file.isFile()) return null;

            ContentResolver resolver = cordova.getActivity().getContentResolver();
            InputStream inputStream = resolver.openInputStream(file.getUri());
            if (inputStream == null) return null;

            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            reader.close();
            inputStream.close();
            return sb.toString();
        } catch (Exception e) {
            Log.e(TAG, "readSafFile error: " + e.getMessage());
            return null;
        }
    }

    private byte[] readSafBinary(String relativePath) {
        try {
            if (safTreeUri.isEmpty()) return null;
            
            DocumentFile file = findSafFile(relativePath);
            if (file == null || !file.isFile()) return null;

            ContentResolver resolver = cordova.getActivity().getContentResolver();
            InputStream inputStream = resolver.openInputStream(file.getUri());
            if (inputStream == null) return null;

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            int nRead;
            byte[] data = new byte[4096];
            while ((nRead = inputStream.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            inputStream.close();
            return buffer.toByteArray();
        } catch (Exception e) {
            Log.e(TAG, "readSafBinary error: " + e.getMessage());
            return null;
        }
    }

    private boolean deleteSafDir(String relativePath) {
        try {
            if (safTreeUri.isEmpty()) return false;
            
            DocumentFile file = findSafFile(relativePath);
            if (file == null) return false;
            
            return file.delete();
        } catch (Exception e) {
            Log.e(TAG, "deleteSafDir error: " + e.getMessage());
            return false;
        }
    }

    private boolean ensureSafDir(String relativePath) {
        try {
            if (safTreeUri.isEmpty()) return false;
            return true;
        } catch (Exception e) {
            Log.e(TAG, "ensureSafDir error: " + e.getMessage());
            return false;
        }
    }

    private DocumentFile findSafFile(String relativePath) {
        try {
            Uri treeUriObj = Uri.parse(safTreeUri);
            DocumentFile treeDoc = DocumentFile.fromTreeUri(cordova.getActivity(), treeUriObj);
            if (treeDoc == null) return null;
            
            String cleanPath = relativePath.replace("/storage/emulated/0/", "");
            String[] parts = cleanPath.split("/");
            DocumentFile current = treeDoc;
            
            for (String part : parts) {
                if (part.isEmpty()) continue;
                DocumentFile child = current.findFile(part);
                if (child == null) return null;
                current = child;
            }
            return current;
        } catch (Exception e) {
            Log.e(TAG, "findSafFile error: " + e.getMessage());
            return null;
        }
    }
}
