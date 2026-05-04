#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

module.exports = function(context) {
    var rootdir = context.opts.projectRoot;
    var srcFile = path.join(rootdir, 'src', 'FlipbookScanner.java');
    var splashSrc = path.join(rootdir, 'src', 'drawable', 'ic_cdv_splashscreen.xml');
    var buildExtrasSrc = path.join(rootdir, 'build-extras.gradle');
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

    var configXmlPath = path.join(platformDir, 'res', 'xml', 'config.xml');
    if (fs.existsSync(configXmlPath)) {
        var configContent = fs.readFileSync(configXmlPath, 'utf8');
        if (!configContent.includes('FlipbookScanner')) {
            var featureEntry = '    <feature name="FlipbookScanner">\n        <param name="android-package" value="com.auto366.flipbook.FlipbookScanner" />\n    </feature>\n';
            configContent = configContent.replace('</widget>', featureEntry + '</widget>');
            fs.writeFileSync(configXmlPath, configContent);
            console.log('Registered: FlipbookScanner in platforms config.xml');
        }
    }

    var splashDestDir = path.join(platformDir, 'res', 'drawable');
    if (fs.existsSync(splashSrc) && fs.existsSync(splashDestDir)) {
        var splashDest = path.join(splashDestDir, 'ic_cdv_splashscreen.xml');
        fs.copyFileSync(splashSrc, splashDest);
        console.log('Copied: ic_cdv_splashscreen.xml -> ' + path.relative(platformDir, splashDest));
    }

    var platformRoot = path.join(rootdir, 'platforms', 'android', 'app');
    if (fs.existsSync(buildExtrasSrc)) {
        var buildExtrasDest = path.join(platformRoot, 'build-extras.gradle');
        fs.copyFileSync(buildExtrasSrc, buildExtrasDest);
        console.log('Copied: build-extras.gradle -> ' + path.relative(platformRoot, buildExtrasDest));
    }
};
