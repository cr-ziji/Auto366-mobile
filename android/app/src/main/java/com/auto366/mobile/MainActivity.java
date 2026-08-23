package com.auto366.mobile;

import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.util.Rational;

import com.auto366.flipbook.FlipbookScannerPlugin;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    public static final String ACTION_SCROLL_UP = "com.auto366.mobile.SCROLL_UP";
    public static final String ACTION_SCROLL_DOWN = "com.auto366.mobile.SCROLL_DOWN";

    private static final String TAG = "MainActivity";
    private static final int REQUEST_CODE_SCROLL_UP = 1;
    private static final int REQUEST_CODE_SCROLL_DOWN = 2;

    /**
     * 画中画进入防抖：两次进入尝试之间的最小间隔。
     * 使用时间戳而不是"进入中"标志位，即使某次进入失败也不会卡死后续手势。
     */
    private static final long PIP_DEBOUNCE_MS = 700L;

    private static volatile MainActivity instance;

    private BroadcastReceiver pipActionReceiver;
    private volatile boolean monitorActive = false;
    private volatile boolean autoPipEnabled = false;
    private volatile boolean suppressAutoPip = false;
    private volatile long lastPipEnterAttemptMs = 0L;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FlipbookScannerPlugin.class);
        super.onCreate(savedInstanceState);
        instance = this;
        // 提前注册滚动广播接收器，避免进入画中画瞬间注册不及时导致第一次点击无效
        registerPipReceiver();
        refreshAutoEnterParams();
    }

    @Override
    public void onResume() {
        super.onResume();
        instance = this;
        suppressAutoPip = false; // 回到前台后恢复自动画中画判定
        refreshAutoEnterParams();
    }

    @Override
    public void onPause() {
        super.onPause();
        refreshAutoEnterParams();
        // Android 12+ 由 setAutoEnterEnabled 覆盖所有场景（含多任务）。
        // Android 11 及以下 onUserLeaveHint 只在"回到桌面"时触发，
        // "上划进多任务/切换到其他应用"不会回调，这里用 onPause 兜底。
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return;
        }
        if (suppressAutoPip) {
            Log.i(TAG, "onPause: auto-pip suppressed (intentional external activity)");
            return;
        }
        if (monitorActive && autoPipEnabled && !isFinishing() && !isEnteringPiP() && isScreenInteractive()) {
            Log.i(TAG, "onPause: auto-entering PiP");
            enterPipMode();
        } else if (monitorActive && autoPipEnabled) {
            // 帮助远程诊断：为什么监听中离开却没进入画中画
            Log.i(TAG, "onPause: skip auto-pip (finishing=" + isFinishing()
                    + ", shouldAutoEnter=" + shouldAutoEnter()
                    + ", inPip=" + isEnteringPiP()
                    + ", interactive=" + isScreenInteractive() + ")");
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterPipReceiver();
        if (instance == this) {
            instance = null;
        }
    }

    /**
     * 由 FlipbookScanner 插件同步 JS 侧状态：
     * monitoring: 是否正在监听
     * autoPip: 是否开启"离开应用自动进入画中画"
     */
    public void setPipAppState(Boolean monitoring, Boolean autoPip) {
        if (monitoring != null) {
            monitorActive = monitoring;
        }
        if (autoPip != null) {
            autoPipEnabled = autoPip;
        }
        Log.i(TAG, "setPipAppState monitoring=" + monitorActive + ", autoPip=" + autoPipEnabled);
        refreshAutoEnterParams();
    }

    private boolean shouldAutoEnter() {
        return monitorActive && autoPipEnabled && !isInPictureInPictureMode();
    }

    /** 主动跳转外部界面（SAF 选择器、系统设置、浏览器）前调用，避免误触自动画中画 */
    public void setSuppressAutoPip(boolean suppress) {
        this.suppressAutoPip = suppress;
        Log.i(TAG, "setSuppressAutoPip: " + suppress);
    }

    private boolean isScreenInteractive() {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isInteractive();
        } catch (Exception e) {
            return true;
        }
    }

    /**
     * Android 12+ (API 31)：使用 setAutoEnterEnabled(true) 由系统在上划/回主屏手势时
     * 无缝自动进入画中画。这是修复"上划手势概率失效"的关键——不再依赖 onUserLeaveHint
     * 与系统转场动画竞态。
     */
    private void refreshAutoEnterParams() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return;
        }
        try {
            setPictureInPictureParams(buildPipParams(shouldAutoEnter()));
        } catch (Exception e) {
            Log.w(TAG, "refreshAutoEnterParams failed: " + e.getMessage());
        }
    }

    private PictureInPictureParams buildPipParams(boolean autoEnter) {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9))
                .setActions(createPipActions());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(autoEnter);
            builder.setSeamlessResizeEnabled(true);
        }
        return builder.build();
    }

    /**
     * Android 12 以下没有 setAutoEnterEnabled，退回 onUserLeaveHint 方案。
     */
    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return; // 由 autoEnter 接管
        }
        Log.i(TAG, "onUserLeaveHint fired: monitorActive=" + monitorActive
                + ", autoPipEnabled=" + autoPipEnabled + ", inPip=" + isEnteringPiP()
                + ", suppressed=" + suppressAutoPip);
        // 部分ROM在打开任意外部界面（SAF选择器、权限页等）时也会回调本方法，
        // 这些"主动跳转"场景不应进入画中画
        if (!suppressAutoPip && monitorActive && autoPipEnabled && !isEnteringPiP()) {
            Log.i(TAG, "onUserLeaveHint: auto-entering PiP");
            enterPipMode();
        }
    }

    private boolean isEnteringPiP() {
        try {
            return isInPictureInPictureMode();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 进入画中画（带防抖）。不阻塞 UI 线程、失败不残留状态。
     */
    public void enterPipMode() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        long now = SystemClock.uptimeMillis();
        synchronized (this) {
            if (now - lastPipEnterAttemptMs < PIP_DEBOUNCE_MS) {
                Log.i(TAG, "enterPipMode debounced (" + PIP_DEBOUNCE_MS + "ms)");
                return;
            }
            if (isEnteringPiP()) {
                Log.i(TAG, "enterPipMode ignored: already in PiP");
                return;
            }
            lastPipEnterAttemptMs = now;
        }
        Log.i(TAG, "enterPipMode called");
        // 注意：这里不预先通知 JS 切换 UI。UI 只由 onPictureInPictureModeChanged
        // （系统真实结果）驱动，否则进入失败时（多任务太晚、熄屏被拒）界面会卡在小窗样式。
        try {
            enterPictureInPictureMode(buildPipParams(false));
        } catch (Exception e) {
            // 失败只记录日志；时间戳防抖会自然过期，不会阻塞下次手势
            Log.e(TAG, "enterPictureInPictureMode failed: " + e.getMessage());
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPip, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPip, newConfig);
        Log.i(TAG, "PiP mode changed: " + isInPip);
        if (isInPip) {
            notifyJs("if(window.app&&typeof window.app._updatePipWindow==='function'){window.app._updatePipWindow();}");
            notifyJs("if(window.app&&typeof window.app._onPipModeChanged==='function'){window.app._onPipModeChanged(true);}");
        } else {
            notifyJs("if(window.app&&typeof window.app._onPipModeChanged==='function'){window.app._onPipModeChanged(false);}");
        }
        // 退出画中画后重新评估 autoEnter 状态（例如仍在监听则恢复 true）
        refreshAutoEnterParams();
    }

    private void notifyJs(final String js) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                Log.w(TAG, "notifyJs failed: " + e.getMessage());
            }
        });
    }

    private void sendScrollEventToJS(String direction) {
        Log.i(TAG, "sendScrollEventToJS: " + direction);
        notifyJs("if(window.app&&typeof window.app._onPipScroll==='function'){window.app._onPipScroll('" + direction + "');}");
    }

    private synchronized void registerPipReceiver() {
        if (pipActionReceiver != null) {
            return;
        }
        pipActionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (ACTION_SCROLL_UP.equals(action)) {
                    sendScrollEventToJS("up");
                } else if (ACTION_SCROLL_DOWN.equals(action)) {
                    sendScrollEventToJS("down");
                }
            }
        };
        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(ACTION_SCROLL_UP);
            filter.addAction(ACTION_SCROLL_DOWN);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(pipActionReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                registerReceiver(pipActionReceiver, filter);
            }
            Log.i(TAG, "PiP scroll receiver registered");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register receiver: " + e.getMessage());
        }
    }

    private synchronized void unregisterPipReceiver() {
        if (pipActionReceiver != null) {
            try {
                unregisterReceiver(pipActionReceiver);
            } catch (Exception ignored) {
            }
            pipActionReceiver = null;
        }
    }

    private List<RemoteAction> createPipActions() {
        List<RemoteAction> actions = new ArrayList<>();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return actions;
        }
        int flags = PendingIntent_FLAG_UPDATE_CURRENT_IMMUTABLE();
        try {
            Icon upIcon = Icon.createWithResource(this, android.R.drawable.arrow_up_float);
            actions.add(new RemoteAction(upIcon, "上滑", "向上滚动",
                    android.app.PendingIntent.getBroadcast(this, REQUEST_CODE_SCROLL_UP,
                            new Intent(ACTION_SCROLL_UP), flags)));

            Icon downIcon = Icon.createWithResource(this, android.R.drawable.arrow_down_float);
            actions.add(new RemoteAction(downIcon, "下滑", "向下滚动",
                    android.app.PendingIntent.getBroadcast(this, REQUEST_CODE_SCROLL_DOWN,
                            new Intent(ACTION_SCROLL_DOWN), flags)));
        } catch (Exception e) {
            Log.e(TAG, "createPipActions failed: " + e.getMessage());
        }
        return actions;
    }

    private int PendingIntent_FLAG_UPDATE_CURRENT_IMMUTABLE() {
        int flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }
}
