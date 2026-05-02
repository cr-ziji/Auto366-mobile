#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

module.exports = function(context) {
    var rootdir = context.opts.projectRoot;
    var srcFile = path.join(rootdir, 'src', 'FlipbookScanner.java');
    var platformDir = path.join(rootdir, 'platforms', 'android', 'app', 'src', 'main');
    var destDir = path.join(platformDir, 'java', 'com', 'auto366', 'flipbook');

    if (!fs.existsSync(srcFile)) {
        console.log('Warning: FlipbookScanner.java not found in src/');
        return;
    }

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    var destFile = path.join(destDir, 'FlipbookScanner.java');
    fs.copyFileSync(srcFile, destFile);
    console.log('Copied: FlipbookScanner.java -> ' + path.relative(platformDir, destFile));
};
