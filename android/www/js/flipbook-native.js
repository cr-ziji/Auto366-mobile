var FlipbookScanner = {
    checkPermission: function(successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'checkPermission', []);
    },

    listFiles: function(path, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'listFiles', [path]);
    },

    readFile: function(path, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'readFile', [path]);
    },

    readBinaryFile: function(path, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'readBinaryFile', [path]);
    },

    clearDirectory: function(path, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'clearDirectory', [path]);
    },

    ensureDirectory: function(path, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'ensureDirectory', [path]);
    },

    openAllFilesAccessSettings: function(successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'openAllFilesAccessSettings', []);
    },

    setSafMode: function(use, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'setSafMode', [use]);
    },

    setUseZeroWidth: function(use, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'setUseZeroWidth', [use]);
    },

    setSafTreeUri: function(uri, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'setSafTreeUri', [uri]);
    },

    requestSafTree: function(successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'FlipbookScanner', 'requestSafTree', []);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlipbookScanner;
}

window.FlipbookScanner = FlipbookScanner;
