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
import android.util.Rational;
import android.app.PendingIntent;

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

    public void registerPipReceiver() {
        if (pipActionReceiver != null) return;

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
                registerReceiver(pipActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(pipActionReceiver, filter);
            }
        } catch (Exception e) {
            e.printStackTrace();
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
        
        registerPipReceiver();
        
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
        
        if (appView != null) {
            String js = "if(window.app&&typeof window.app._onPipModeChanged==='function'){window.app._onPipModeChanged(" + isInPictureInPictureMode + ");}";
            appView.sendJavascript(js);
        }
        
        if (!isInPictureInPictureMode) {
            unregisterPipReceiver();
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
