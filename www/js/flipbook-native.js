/**
 * FlipbookScanner 原生桥（Capacitor 版）。
 * 对外保持与 Cordova 版完全相同的回调式 API，业务代码无需改动。
 * 新增 listTree / setAppState / openUrl 三个方法。
 *
 * 注意：Capacitor 全局桥接对象在部分版本上不暴露 registerPlugin 函数，
 * 只有 window.Capacitor.Plugins 代理，因此这里在每次调用时懒解析插件引用，
 * 避免脚本解析早于桥接注入导致的竞态问题。
 */
(function () {
    function getNative() {
        var C = window.Capacitor;
        if (!C) return null;
        if (typeof C.registerPlugin === 'function') {
            try {
                return C.registerPlugin('FlipbookScanner');
            } catch (e) {
                /* fallthrough */
            }
        }
        if (C.Plugins && C.Plugins.FlipbookScanner) {
            return C.Plugins.FlipbookScanner;
        }
        return null;
    }

    function call(method, args, successCallback, errorCallback, transform) {
        var native = getNative();
        if (!native || typeof native[method] !== 'function') {
            if (errorCallback) errorCallback('FlipbookScanner 原生插件不可用');
            return;
        }
        try {
            native[method](args || {})
                .then(function (result) {
                    if (successCallback) successCallback(transform ? transform(result) : result);
                })
                .catch(function (error) {
                    if (errorCallback) errorCallback(error && error.message ? error.message : String(error));
                });
        } catch (e) {
            if (errorCallback) errorCallback(e.message || String(e));
        }
    }

    var FlipbookScanner = {
        checkPermission: function (successCallback, errorCallback) {
            call('checkPermission', {}, successCallback, errorCallback);
        },

        listFiles: function (path, successCallback, errorCallback) {
            call('listFiles', { path: path }, successCallback, errorCallback, function (r) {
                return (r && r.entries) || [];
            });
        },

        /**
         * 一次调用返回整棵目录树：
         * { name, path, isDirectory, isFile, size, lastModified, children: [...] }
         */
        listTree: function (path, maxDepth, successCallback, errorCallback) {
            if (typeof maxDepth === 'function') {
                errorCallback = successCallback;
                successCallback = maxDepth;
                maxDepth = undefined;
            }
            call('listTree', { path: path, maxDepth: maxDepth }, successCallback, errorCallback, function (r) {
                return r ? r.root : null;
            });
        },

        readFile: function (path, successCallback, errorCallback) {
            call('readFile', { path: path }, successCallback, errorCallback);
        },

        readBinaryFile: function (path, successCallback, errorCallback) {
            call('readBinaryFile', { path: path }, successCallback, errorCallback);
        },

        clearDirectory: function (path, successCallback, errorCallback) {
            call('clearDirectory', { path: path }, successCallback, errorCallback);
        },

        ensureDirectory: function (path, successCallback, errorCallback) {
            call('ensureDirectory', { path: path }, successCallback, errorCallback);
        },

        openAllFilesAccessSettings: function (successCallback, errorCallback) {
            call('openAllFilesAccessSettings', {}, successCallback, errorCallback);
        },

        setSafMode: function (use, successCallback, errorCallback) {
            call('setSafMode', { enabled: !!use }, successCallback, errorCallback);
        },

        setUseZeroWidth: function (use, successCallback, errorCallback) {
            call('setUseZeroWidth', { enabled: !!use }, successCallback, errorCallback);
        },

        setSafTreeUri: function (uri, successCallback, errorCallback) {
            call('setSafTreeUri', { uri: uri }, successCallback, errorCallback);
        },

        requestSafTree: function (successCallback, errorCallback) {
            call('requestSafTree', {}, successCallback, errorCallback);
        },

        enterPipMode: function (successCallback, errorCallback) {
            call('enterPipMode', {}, successCallback, errorCallback);
        },

        /** 同步监听状态到原生层（用于上划手势自动进入画中画的判定） */
        setAppState: function (state, successCallback, errorCallback) {
            call('setAppState', state, successCallback, errorCallback);
        },

        openUrl: function (url, errorCallback) {
            call('openUrl', { url: url }, null, errorCallback);
        }
    };

    Object.defineProperty(FlipbookScanner, 'available', {
        get: function () { return !!getNative(); }
    });

    window.FlipbookScanner = FlipbookScanner;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FlipbookScanner;
    }
})();
