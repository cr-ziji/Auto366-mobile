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
import java.io.File;
import java.io.FileReader;
import java.io.FileInputStream;
import java.io.IOException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.app.Activity;
import android.util.Base64;
import java.util.HashMap;
import java.util.Map;

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

    private Map<String, String> bypassPathCache = new HashMap<>();

    private String bypassPath(String originalPath) {
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
        });
    }

    private void readFile(String path, CallbackContext callbackContext) {
        cordova.getThreadPool().execute(() -> {
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
            try {
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
            String actualPath = bypassPath(path);
            File file = new File(actualPath);
            Log.i(TAG, "Read binary file: " + actualPath);
            if (!file.exists() || !file.isFile()) {
                callbackContext.error("File does not exist: " + path);
                return;
            }
            try {
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
            String actualPath = bypassPath(path);
            File dir = new File(actualPath);
            if (!dir.exists() || !dir.isDirectory()) {
                callbackContext.error("Directory does not exist: " + path);
                return;
            }
            boolean success = deleteDirContents(dir);
            try {
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
            String actualPath = bypassPath(path);
            File dir = new File(actualPath);
            Log.i(TAG, "Ensure directory original path: " + path);
            Log.i(TAG, "Ensure directory bypass path: " + actualPath);

            if (!dir.exists()) {
                boolean created = dir.mkdirs();
                Log.i(TAG, "Directory created: " + created);
            }

            try {
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
}
