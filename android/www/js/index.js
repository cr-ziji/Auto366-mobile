/**
 * Auto366 Mobile - Cordova Device Ready Handler
 * 天学网自动化答题工具移动版
 */

// 等待设备准备就绪事件
document.addEventListener('deviceready', onDeviceReady, false);

// 备用初始化（用于浏览器测试）
document.addEventListener('DOMContentLoaded', function() {
    // 如果5秒内没有触发deviceready事件，则直接初始化
    setTimeout(() => {
        if (!window.app && typeof Auto366Mobile !== 'undefined') {
            console.log('Fallback initialization for browser testing');
            window.app = new Auto366Mobile();
            window.app.init();
        }
    }, 1000);
});

function onDeviceReady() {
    console.log('Cordova device ready');
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    
    // 设置状态栏
    if (window.StatusBar) {
        StatusBar.styleDefault();
        StatusBar.overlaysWebView(false);
        StatusBar.backgroundColorByHexString('#007bff');
    }
    
    // 立即隐藏启动画面
    if (navigator.splashscreen) {
        navigator.splashscreen.hide();
    }
    
    // 初始化应用
    if (typeof Auto366Mobile !== 'undefined') {
        window.app = new Auto366Mobile();
        window.app.init();
    }
    
    // 处理返回按钮
    document.addEventListener('backbutton', onBackKeyDown, false);
    
    // 处理菜单按钮
    document.addEventListener('menubutton', onMenuKeyDown, false);
    
    // 处理暂停和恢复
    document.addEventListener('pause', onPause, false);
    document.addEventListener('resume', onResume, false);
    
    // 网络状态监听
    document.addEventListener('online', onOnline, false);
    document.addEventListener('offline', onOffline, false);
    
    console.log('Cordova initialization complete');
}

function onBackKeyDown() {
    // 如果菜单打开，先关闭菜单
    const sideMenu = document.getElementById('sideMenu');
    if (sideMenu && sideMenu.classList.contains('open')) {
        if (window.app) {
            window.app.closeMenu();
        }
        return;
    }
    
    // 如果不在主视图，返回主视图
    if (window.app && window.app.currentView !== 'proxy') {
        window.app.showView('proxy');
        return;
    }
    
    // 确认退出应用
    if (navigator.notification) {
        navigator.notification.confirm(
            '确定要退出Auto366吗？',
            function(buttonIndex) {
                if (buttonIndex === 1) {
                    navigator.app.exitApp();
                }
            },
            'Auto366',
            ['确定', '取消']
        );
    } else {
        if (confirm('确定要退出Auto366吗？')) {
            navigator.app.exitApp();
        }
    }
}

function onMenuKeyDown() {
    // 切换菜单
    if (window.app) {
        window.app.toggleMenu();
    }
}

function onPause() {
    console.log('App paused');
    // 应用暂停时的处理
    if (window.app) {
        // 可以在这里保存应用状态
        window.app.saveSettings();
    }
}

function onResume() {
    console.log('App resumed');
    // 应用恢复时的处理
    if (window.app) {
        // 可以在这里恢复应用状态
        window.app.loadSettings();
        window.app.updateUI();
    }
}

function onOnline() {
    console.log('Network online');
    if (window.app) {
        window.app.showToast('网络已连接', 'success');
        window.app.addLog('网络已连接', 'success');
    }
}

function onOffline() {
    console.log('Network offline');
    if (window.app) {
        window.app.showToast('网络已断开', 'warning');
        window.app.addLog('网络已断开', 'warning');
    }
}

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    if (window.app && typeof window.app.addLog === 'function') {
        window.app.addLog(`应用错误: ${e.error.message}`, 'error');
    }
});

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    if (window.app && typeof window.app.addLog === 'function') {
        window.app.addLog(`Promise错误: ${e.reason}`, 'error');
    }
});
