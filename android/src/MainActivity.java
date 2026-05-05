/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

package com.auto366.mobile;

import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.util.Rational;
import android.app.PendingIntent;
import android.util.Log;

import org.apache.cordova.*;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends CordovaActivity
{
    public static final String ACTION_SCROLL_UP = "com.auto366.mobile.SCROLL_UP";
    public static final String ACTION_SCROLL_DOWN = "com.auto366.mobile.SCROLL_DOWN";
    private static final int REQUEST_CODE_SCROLL_UP = 1;
    private static final int REQUEST_CODE_SCROLL_DOWN = 2;

    private BroadcastReceiver pipActionReceiver;
    public static MainActivity instance = null;
    private boolean isMonitoring = false;
    private boolean autoPipMode = false;
    private boolean isEnteringPip = false;

    public void setMonitoring(boolean monitoring) {
        this.isMonitoring = monitoring;
    }

    public void setAutoPipMode(boolean autoPip) {
        this.autoPipMode = autoPip;
    }

    @Override
    public void onCreate(Bundle savedInstanceState)
    {
        super.onCreate(savedInstanceState);
        instance = this;

        Bundle extras = getIntent().getExtras();
        if (extras != null && extras.getBoolean("cdvStartInBackground", false)) {
            moveTaskToBack(true);
        }

        loadUrl(launchUrl);
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.i("MainActivity", "onPause: isMonitoring=" + isMonitoring + ", autoPipMode=" + autoPipMode + ", isInPip=" + isInPictureInPictureMode());
    }

    @Override
    protected void onResume() {
        super.onResume();
        instance = this;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterPipReceiver();
        if (instance == this) instance = null;
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        Log.i("MainActivity", "onUserLeaveHint: isMonitoring=" + isMonitoring + ", autoPipMode=" + autoPipMode + ", isInPip=" + isInPictureInPictureMode());
        if (isMonitoring && autoPipMode && !isEnteringPip && !isInPictureInPictureMode()) {
            isEnteringPip = true;
            Log.i("MainActivity", "Auto-entering PiP on user leave");
            enterPipMode();
        }
    }

    public void registerPipReceiver() {
        if (pipActionReceiver != null) {
            Log.i("MainActivity", "Receiver already registered");
            return;
        }

        pipActionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                Log.i("MainActivity", "Broadcast received: " + action);
                if (ACTION_SCROLL_UP.equals(action)) {
                    Log.i("MainActivity", "Scroll UP triggered");
                    sendScrollEventToJS("up");
                } else if (ACTION_SCROLL_DOWN.equals(action)) {
                    Log.i("MainActivity", "Scroll DOWN triggered");
                    sendScrollEventToJS("down");
                }
            }
        };

        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(ACTION_SCROLL_UP);
            filter.addAction(ACTION_SCROLL_DOWN);
            filter.setPriority(1000);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(pipActionReceiver, filter, Context.RECEIVER_EXPORTED);
                Log.i("MainActivity", "Receiver registered with RECEIVER_EXPORTED");
            } else {
                registerReceiver(pipActionReceiver, filter);
                Log.i("MainActivity", "Receiver registered normally");
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Failed to register receiver: " + e.getMessage());
        }
    }

    public void unregisterPipReceiver() {
        if (pipActionReceiver != null) {
            try {
                unregisterReceiver(pipActionReceiver);
            } catch (Exception e) {}
            pipActionReceiver = null;
        }
    }

    private void sendScrollEventToJS(String direction) {
        android.util.Log.i("MainActivity", "sendScrollEventToJS: " + direction);
        if (appView != null) {
            String js = "if(window.app&&typeof window.app._onPipScroll==='function'){window.app._onPipScroll('" + direction + "');}";
            appView.sendJavascript(js);
        }
    }

    public void enterPipMode() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        
        Log.i("MainActivity", "enterPipMode called");
        registerPipReceiver();

        if (appView != null) {
            appView.sendJavascript("if(window.app&&typeof window.app._enterPipMode==='function'){window.app._enterPipMode();}");
        }
        
        try { Thread.sleep(300); } catch (InterruptedException e) {}
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .setActions(createPipActions());
            enterPictureInPictureMode(builder.build());
        } else {
            enterPictureInPictureMode();
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode);
        Log.i("MainActivity", "PiP mode changed: " + isInPictureInPictureMode);
        
        if (appView != null) {
            if (isInPictureInPictureMode) {
                appView.sendJavascript("if(window.app&&typeof window.app._updatePipWindow==='function'){window.app._updatePipWindow();}");
            } else {
                appView.sendJavascript("if(window.app&&typeof window.app._exitPipMode==='function'){window.app._exitPipMode();}");
            }
        }
        
        if (!isInPictureInPictureMode) {
            isEnteringPip = false;
            Log.i("MainActivity", "Exited PiP, resetting flag");
        }
    }

    private List<RemoteAction> createPipActions() {
        List<RemoteAction> actions = new ArrayList<>();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return actions;

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        try {
            Icon upIcon = Icon.createWithResource(this, android.R.drawable.arrow_up_float);
            actions.add(new RemoteAction(upIcon, "上滑", "向上滚动",
                PendingIntent.getBroadcast(this, REQUEST_CODE_SCROLL_UP,
                    new Intent(ACTION_SCROLL_UP), flags)));

            Icon downIcon = Icon.createWithResource(this, android.R.drawable.arrow_down_float);
            actions.add(new RemoteAction(downIcon, "下滑", "向下滚动",
                PendingIntent.getBroadcast(this, REQUEST_CODE_SCROLL_DOWN,
                    new Intent(ACTION_SCROLL_DOWN), flags)));
        } catch (Exception e) {
            e.printStackTrace();
        }

        return actions;
    }
}
