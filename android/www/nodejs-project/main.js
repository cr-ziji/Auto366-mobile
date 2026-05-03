const cordova = require('cordova-bridge');
const fs = require('fs');
const path = require('path');
const StreamZip = require('node-stream-zip');

function findU3encFiles(dirPath) {
    const results = [];
    try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) results.push(...findU3encFiles(itemPath));
            else if (item.toLowerCase() === 'page1.js.u3enc') results.push(itemPath);
        }
    } catch (error) { console.error('findU3encFiles failed:', error); }
    return results;
}

function findAnswerFiles(dirPath) {
    const answerFiles = [];
    try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) answerFiles.push(...findAnswerFiles(itemPath));
            else {
                const ext = path.extname(item).toLowerCase();
                const name = item.toLowerCase();
                if (['.json', '.js', '.xml', '.txt'].includes(ext)) {
                    if (name.includes('answer') || name.includes('paper') || name.includes('question') || name.includes('questiondata')) {
                        answerFiles.push(itemPath);
                    }
                }
            }
        }
    } catch (error) { console.error('findAnswerFiles failed:', error); }
    return answerFiles;
}

async function processZipFile(zipPath) {
    const allAnswers = [];
    try {
        const extractDir = zipPath.replace('.zip', '');
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        fs.mkdirSync(extractDir, { recursive: true });

        const zip = new StreamZip.async({ file: zipPath });
        await zip.extract(null, extractDir);
        await zip.close();

        const u3encFiles = findU3encFiles(extractDir);
        const answerFiles = findAnswerFiles(extractDir);

        cordova.channel.post('process-result', {
            success: true,
            u3encFiles: u3encFiles,
            answerFiles: answerFiles,
            source: zipPath
        });

        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}
    } catch (error) {
        console.error('processZipFile failed:', error);
        cordova.channel.post('process-result', { success: false, error: error.message, source: zipPath });
    }
}

function processDirectory(dirPath) {
    try {
        const u3encFiles = findU3encFiles(dirPath);
        const answerFiles = findAnswerFiles(dirPath);
        cordova.channel.post('process-result', {
            success: true,
            u3encFiles: u3encFiles,
            answerFiles: answerFiles,
            source: dirPath
        });
    } catch (error) {
        cordova.channel.post('process-result', { success: false, error: error.message, source: dirPath });
    }
}

function processFile(filePath) {
    try {
        const stat = fs.statSync(filePath);
        cordova.channel.post('process-result', {
            success: true,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            source: filePath
        });
    } catch (error) {
        cordova.channel.post('process-result', { success: false, error: error.message, source: filePath });
    }
}

cordova.channel.on('process-zip', async (zipPath) => {
    await processZipFile(zipPath);
});

cordova.channel.on('process-directory', (dirPath) => {
    processDirectory(dirPath);
});

cordova.channel.on('process-file', (filePath) => {
    processFile(filePath);
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
