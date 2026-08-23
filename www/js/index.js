/**
 * Auto366 Mobile - Capacitor 启动入口。
 * 替代原 Cordova 版的 deviceready / backbutton / notification / app 桥接。
 *
 * 注意：原生桥接 JS 的注入与页面脚本解析存在竞态，
 * 因此所有插件引用都在使用时懒解析，并在桥接就绪后再挂监听/引导启动。
 */
(function () {
    function plugins() {
        return (window.Capacitor && window.Capacitor.Plugins) || {};
    }

    function plugin(name) {
        var p = plugins();
        if (p[name]) return p[name];
        var C = window.Capacitor;
        if (C && typeof C.registerPlugin === 'function') {
            try { return C.registerPlugin(name); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function isNative() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }

    /** 等待 Capacitor 桥接就绪（最多约 8 秒），就绪或超时后回调 */
    function whenBridgeReady(callback) {
        var tries = 0;
        (function poll() {
            tries++;
            var ready = !isNative() || !!plugins().App;
            if (ready || tries > 80) {
                callback();
            } else {
                setTimeout(poll, 100);
            }
        })();
    }

    var bootstrapped = false;

    function bootstrapApp() {
        // 注意：index.html 存在 <div id="app">，浏览器会把该元素自动暴露为
        // window.app，因此不能用真值判断，必须用标志位并显式覆盖赋值。
        if (bootstrapped) return;
        bootstrapped = true;
        window.app = new Auto366App();
        window.app.init();
    }

    function initStatusBar() {
        var StatusBar = plugin('StatusBar');
        if (!StatusBar || !isNative()) return;
        try {
            if (StatusBar.setOverlaysWebView) StatusBar.setOverlaysWebView({ overlay: false }).catch(function () {});
            if (StatusBar.setStyle) StatusBar.setStyle({ style: 'DARK' }).catch(function () {}); // 深色背景 + 浅色内容
            if (StatusBar.setBackgroundColor) StatusBar.setBackgroundColor({ color: '#1976D2' }).catch(function () {});
        } catch (e) {
            console.warn('StatusBar init failed', e);
        }
    }

    function hideSplash() {
        var SplashScreen = plugin('SplashScreen');
        if (SplashScreen && SplashScreen.hide) SplashScreen.hide().catch(function () {});
    }

    function confirmDialog(message, callback) {
        var Dialog = plugin('Dialog');
        if (Dialog && Dialog.confirm) {
            Dialog.confirm({
                title: 'Auto366',
                message: message,
                okButtonTitle: '确定',
                cancelButtonTitle: '取消'
            }).then(function (value) {
                // @capacitor/dialog 经全局代理返回的是 { value: boolean } 对象，
                // 直接 !!value 会把"取消"也当成 true
                var v = value;
                if (v && typeof v === 'object' && 'value' in v) {
                    v = v.value;
                }
                callback(!!v);
            }).catch(function () {
                callback(window.confirm(message));
            });
        } else {
            callback(window.confirm(message));
        }
    }

    function exitApp() {
        var App = plugin('App');
        if (App && App.exitApp) {
            App.exitApp();
        } else {
            window.close();
        }
    }

    function onBackKeyDown() {
        if (window.app && window.app.isFloating) {
            window.app.hideFloatingWindow();
            return;
        }

        var sideMenu = document.getElementById('sideMenu');
        if (sideMenu && sideMenu.classList.contains('open')) {
            window.app.closeMenu();
            return;
        }

        if (window.app && window.app.currentView !== 'home') {
            window.app.showView('home');
            return;
        }

        if (window.app && window.app.isMonitoring) {
            confirmDialog('监听正在运行，确定要退出吗？', function (ok) {
                if (ok) {
                    window.app.stopMonitoring();
                    exitApp();
                }
            });
            return;
        }

        confirmDialog('确定要退出 Auto366 吗？', function (ok) {
            if (ok) exitApp();
        });
    }

    function registerLifecycleListeners() {
        var App = plugin('App');
        if (App && App.addListener) {
            App.addListener('backButton', onBackKeyDown);
            App.addListener('appStateChange', function (state) {
                console.log(state && state.isActive === false ? 'App paused' : 'App resumed');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        whenBridgeReady(function () {
            initStatusBar();
            hideSplash();
            registerLifecycleListeners();
            bootstrapApp();
        });
    });

    // 浏览器直接打开时的兜底
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            if (!isNative()) bootstrapApp();
        }, 300);
    });

    window.addEventListener('error', function (e) {
        console.error('Global error:', e.error);
        if (window.app && typeof window.app.addLog === 'function') {
            window.app.addLog('应用错误: ' + (e.error ? e.error.message : 'Unknown'), 'error');
        }
    });

    window.addEventListener('unhandledrejection', function (e) {
        console.error('Unhandled rejection:', e.reason);
        if (window.app && typeof window.app.addLog === 'function') {
            window.app.addLog('Promise错误: ' + e.reason, 'error');
        }
    });
})();
