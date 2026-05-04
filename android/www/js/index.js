document.addEventListener('deviceready', onDeviceReady, false);

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (!window.app) {
            console.log('Browser fallback init');
            window.app = new Auto366App();
            window.app.init();
        }
    }, 1000);
});

function onDeviceReady() {
    console.log('Cordova device ready');

    if (window.StatusBar) {
        StatusBar.styleLightContent();
        StatusBar.overlaysWebView(false);
        StatusBar.backgroundColorByHexString('#1976D2');
    }

    if (navigator.splashscreen) {
        navigator.splashscreen.hide();
    }

    window.app = new Auto366App();
    window.app.init();

    document.addEventListener('backbutton', onBackKeyDown, false);
    document.addEventListener('pause', onPause, false);
    document.addEventListener('resume', onResume, false);

    window.PictureInPicture_Promise = {
        isPipModeSupported: () => {
            return new Promise((resolve, reject) => {
                window.PictureInPicture.isPipModeSupported(resolve, reject);
            });
        },
        isPip: () => {
            return new Promise((resolve, reject) => {
                window.PictureInPicture.isPip(resolve, reject);
            });
        },
        enter: (width, height) => {
            return new Promise((resolve, reject) => {
                window.PictureInPicture.enter(width, height, resolve, reject);
            });
        },
        onPipModeChanged: window.PictureInPicture.onPipModeChanged
    }
}

function onBackKeyDown() {
    if (window.app && window.app.isFloating) {
        window.app.hideFloatingWindow();
        return;
    }

    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu && sideMenu.classList.contains('open')) {
        window.app.closeMenu();
        return;
    }

    if (window.app && window.app.currentView !== 'home') {
        window.app.showView('home');
        return;
    }

    if (window.app && window.app.isMonitoring) {
        if (navigator.notification) {
            navigator.notification.confirm(
                '监听正在运行，确定要退出吗？',
                function(buttonIndex) {
                    if (buttonIndex === 1) {
                        window.app.stopMonitoring();
                        navigator.app.exitApp();
                    }
                },
                'Auto366',
                ['确定退出', '取消']
            );
        } else {
            if (confirm('监听正在运行，确定要退出吗？')) {
                window.app.stopMonitoring();
                navigator.app.exitApp();
            }
        }
        return;
    }

    if (navigator.notification) {
        navigator.notification.confirm(
            '确定要退出 Auto366 吗？',
            function(buttonIndex) {
                if (buttonIndex === 1) navigator.app.exitApp();
            },
            'Auto366',
            ['确定', '取消']
        );
    } else {
        if (confirm('确定要退出 Auto366 吗？')) {
            navigator.app.exitApp();
        }
    }
}

async function createFloatingWindow(width, height) {
    try {
        const supported = await window.PictureInPicture_Promise.isPipModeSupported();
        if (supported !== "true") {
            console.log("当前设备不支持画中画");
            return;
        }
        const isInPip = await window.PictureInPicture_Promise.isPip();
        if (isInPip === "true") {
            console.log("已在画中画模式");
            return;
        }
        await window.PictureInPicture_Promise.enter(width, height);
        console.log("悬浮窗创建成功");

    } catch (error) {
        console.error("创建悬浮窗失败:", error);
    }
}

function onPause() {
    console.log('App paused');
    createFloatingWindow(600, 900);
}

function onResume() {
    console.log('App resumed');
}

window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    if (window.app && typeof window.app.addLog === 'function') {
        window.app.addLog('应用错误: ' + (e.error ? e.error.message : 'Unknown'), 'error');
    }
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled rejection:', e.reason);
    if (window.app && typeof window.app.addLog === 'function') {
        window.app.addLog('Promise错误: ' + e.reason, 'error');
    }
});
