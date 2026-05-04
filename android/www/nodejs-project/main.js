const cordova = require('cordova-bridge');
const fs = require('fs');
const path = require('path');
const StreamZip = require('node-stream-zip');

async function processZipFile(zipPath) {
    try {
        const extractDir = zipPath.replace('.zip', '');
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        fs.mkdirSync(extractDir, { recursive: true });

        const zip = new StreamZip.async({ file: zipPath });
        await zip.extract(null, extractDir);
        await zip.close();

        cordova.channel.post('process-result', {
            success: true,
            extractDir: extractDir,
            source: zipPath
        });
    } catch (error) {
        console.error('processZipFile failed:', error);
        cordova.channel.post('process-result', { success: false, error: error.message, source: zipPath });
    }
}

cordova.channel.on('process-zip', async (zipPath) => {
    await processZipFile(zipPath);
});

cordova.channel.on('read-directory-entries', (dirPath) => {
    try {
        const entries = fs.readdirSync(dirPath).map(name => {
            const fullPath = path.join(dirPath, name);
            try {
                const stat = fs.statSync(fullPath);
                return { name, isDirectory: stat.isDirectory(), isFile: stat.isFile() };
            } catch (e) {
                return { name, isDirectory: false, isFile: false };
            }
        });
        cordova.channel.post('read-directory-entries-result', { success: true, entries });
    } catch (error) {
        cordova.channel.post('read-directory-entries-result', { success: false, error: error.message });
    }
});

cordova.channel.on('clear-directory', (dirPath) => {
    try {
        if (fs.existsSync(dirPath)) {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) fs.rmSync(itemPath, { recursive: true, force: true });
                else fs.unlinkSync(itemPath);
            }
        }
        cordova.channel.post('clear-directory-result', { success: true });
    } catch (error) {
        cordova.channel.post('clear-directory-result', { success: false, error: error.message });
    }
});

cordova.channel.on('ensure-directory', (dirPath) => {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
        cordova.channel.post('ensure-directory-result', { success: true });
    } catch (error) {
        cordova.channel.post('ensure-directory-result', { success: false, error: error.message });
    }
});
