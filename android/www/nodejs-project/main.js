const cordova = require('cordova-bridge');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const StreamZip = require('node-stream-zip');

const appPath = cordova.app.datadir();
const tempDir = path.join(appPath, 'temp');
const U3ENC_KEY = Buffer.from('QJBNiBmV55PDrewyne3GsA==', 'base64');

function decryptU3enc(encryptedData) {
    if (encryptedData.length < 16) return null;
    const iv = encryptedData.slice(0, 16);
    const ciphertext = encryptedData.slice(16);
    try {
        const decipher = crypto.createDecipheriv('aes-128-cbc', U3ENC_KEY, iv);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (error) {
        console.error('u3enc decrypt failed:', error.message);
        return null;
    }
}

function cleanHtmlText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\\/g, '')
        .trim();
}

function extractJsonFromPageConfig(content) {
    const match = content.match(/var\s+pageConfig\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (match && match[1]) return match[1];
    const startIndex = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (startIndex !== -1 && lastBrace !== -1 && lastBrace > startIndex) {
        return content.substring(startIndex, lastBrace + 1);
    }
    return null;
}

function extractFromPage1(pageConfig) {
    const answers = [];
    try {
        if (!pageConfig || !pageConfig.slides) return answers;
        for (const slide of pageConfig.slides) {
            const questionList = slide.questionList || [];
            for (const question of questionList) {
                const qtypeId = question.qtype_id;
                if (question.answer_text && question.options && question.options.length > 0) {
                    const correctOption = question.options.find(opt => opt.id === question.answer_text);
                    if (correctOption) {
                        answers.push({
                            question: cleanHtmlText(question.question_text || ''),
                            answer: `${question.answer_text}. ${cleanHtmlText(correctOption.content?.trim() || '')}`,
                            pattern: '听后选择'
                        });
                    }
                }
                if (question.questions_list && question.questions_list.length > 0) {
                    for (const q of question.questions_list) {
                        if (q.answer_text && q.options && q.options.length > 0) {
                            const correctOption = q.options.find(opt => opt.id === q.answer_text);
                            if (correctOption) {
                                answers.push({
                                    question: cleanHtmlText(q.question_text || ''),
                                    answer: `${q.answer_text}. ${cleanHtmlText(correctOption.content?.trim() || '')}`,
                                    pattern: '听后选择-嵌套'
                                });
                            }
                        }
                    }
                }
                if (qtypeId === 237 && question.record_speak && question.record_speak.length > 0) {
                    const correctAnswers = question.record_speak.filter(item => item.work === "1" && item.show === "1");
                    for (const item of correctAnswers) {
                        if (item.content && item.content.trim()) {
                            answers.push({
                                question: cleanHtmlText(question.question_text || '口语跟读'),
                                answer: cleanHtmlText(item.content.trim()),
                                pattern: '口语跟读'
                            });
                        }
                    }
                }
                if (qtypeId === 449 && question.analysis && question.analysis.trim()) {
                    const analysisText = cleanHtmlText(question.analysis).trim();
                    if (analysisText) {
                        answers.push({ question: '朗读文本', answer: analysisText, pattern: '朗读' });
                    }
                }
                if (qtypeId === 554 && question.analysis && question.analysis.trim()) {
                    let analysisText = question.analysis
                        .replace(/<p[^>]*>答案[一二三四五六七八九十]+：<\/p>/g, '')
                        .replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ').trim();
                    if (analysisText) {
                        const firstAnswer = analysisText.split(/\s*答案[一二三四五六七八九十]+：\s*/)[0] || analysisText;
                        answers.push({
                            question: cleanHtmlText(question.question_text || '故事复述'),
                            answer: firstAnswer.trim(),
                            pattern: '故事复述'
                        });
                    }
                }
                if (qtypeId === 503) {
                    if (question.analysis && question.analysis.trim()) {
                        const analysisText = cleanHtmlText(question.analysis).trim();
                        if (analysisText) {
                            answers.push({
                                question: cleanHtmlText(question.question_text || '听力填空'),
                                answer: analysisText,
                                pattern: '听力填空'
                            });
                        }
                    } else if (question.record_follow_read?.paragraph_list) {
                        for (const para of question.record_follow_read.paragraph_list) {
                            for (const sent of (para.sentences || [])) {
                                if (sent.keyNo && sent.content_en) {
                                    const boldMatch = sent.content_en.match(/<b>([^<]+)<\/b>/);
                                    const answerText = boldMatch ? boldMatch[1] : cleanHtmlText(sent.content_en);
                                    if (answerText.trim()) {
                                        answers.push({
                                            question: `问题 ${sent.keyNo}`,
                                            answer: answerText.trim(),
                                            pattern: '听力填空'
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('extractFromPage1 failed:', error);
    }
    return answers;
}

function detectExactType(questionObj) {
    if ((questionObj.questions_list && questionObj.questions_list.length > 0 &&
        questionObj.questions_list[0].options && questionObj.questions_list[0].options.length > 0) ||
        (questionObj.options && questionObj.options.length > 0 && questionObj.answer_text)) {
        return '听后选择';
    }
    if (hasAnswerAttributes(questionObj)) return '听后回答';
    if (questionObj.record_speak && questionObj.record_speak.length > 0) {
        const firstItem = questionObj.record_speak[0];
        if (firstItem && !firstItem.work && !firstItem.show &&
            firstItem.content && firstItem.content.length > 100) return '听后转述';
    }
    if (questionObj.record_follow_read ||
        (questionObj.analysis && /\/\//.test(questionObj.analysis))) return '朗读短文';
    return '未知';
}

function hasAnswerAttributes(questionObj) {
    if (questionObj.record_speak && questionObj.record_speak.length > 0) {
        const firstItem = questionObj.record_speak[0];
        if (firstItem && (firstItem.work === "1" || firstItem.work === 1 ||
            firstItem.show === "1" || firstItem.show === 1)) return true;
    }
    if (questionObj.questions_list && questionObj.questions_list.length > 0) {
        for (const question of questionObj.questions_list) {
            if (question.record_speak && question.record_speak.length > 0) {
                const firstRecord = question.record_speak[0];
                if (firstRecord && (firstRecord.work === "1" || firstRecord.work === 1 ||
                    firstRecord.show === "1" || firstRecord.show === 1)) return true;
            }
        }
    }
    return false;
}

function parseQuestionFile(fileContent) {
    try {
        const config = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
        const questionObj = config.questionObj || {};
        const detectedType = detectExactType(questionObj);
        switch (detectedType) {
            case '听后选择': return parseChoiceQuestions(questionObj);
            case '听后回答': return parseAnswerQuestions(questionObj);
            case '听后转述': return parseRetellContent(questionObj);
            case '朗读短文': return parseReadingContent(questionObj);
            default: return parseFallback(questionObj);
        }
    } catch (error) { return []; }
}

function parseChoiceQuestions(questionObj) {
    const results = [];
    if (questionObj.questions_list) {
        questionObj.questions_list.forEach((question, index) => {
            if (question.answer_text && question.options) {
                const correctOption = question.options.find(opt => opt.id === question.answer_text);
                if (correctOption) {
                    results.push({
                        question: `第${index + 1}题: ${question.question_text || '未知问题'}`,
                        answer: `${question.answer_text}. ${correctOption.content?.trim() || ''}`,
                        pattern: '听后选择'
                    });
                }
            }
        });
    }
    if (results.length === 0 && questionObj.options && questionObj.options.length > 0 && questionObj.answer_text) {
        const correctOption = questionObj.options.find(opt => opt.id === questionObj.answer_text);
        if (correctOption) {
            results.push({
                question: `第1题: ${cleanHtmlText(questionObj.question_text || '未知问题')}`,
                answer: `${questionObj.answer_text}. ${correctOption.content?.trim() || ''}`,
                pattern: '听后选择'
            });
        }
    }
    return results;
}

function parseAnswerQuestions(questionObj) {
    const results = [];
    if (questionObj.questions_list) {
        questionObj.questions_list.forEach((question, qIndex) => {
            if (question.record_speak) {
                const answers = question.record_speak
                    .filter(item => item.show === "1" || item.show === 1)
                    .map(item => item.content?.trim() || '')
                    .filter(content => content && content !== '<answers/>');
                answers.forEach((answer, aIndex) => {
                    results.push({
                        question: `第${qIndex + 1}题 - 答案${aIndex + 1}`,
                        answer: answer,
                        pattern: '听后回答'
                    });
                });
            }
        });
    }
    if (questionObj.record_speak && results.length === 0) {
        const answers = questionObj.record_speak
            .filter(item => item.show === "1" || item.show === 1)
            .map(item => item.content?.trim() || '')
            .filter(content => content && content !== '<answers/>');
        answers.forEach((answer, index) => {
            results.push({
                question: `第1题 - 答案${index + 1}`,
                answer: answer,
                pattern: '听后回答'
            });
        });
    }
    return results;
}

function parseRetellContent(questionObj) {
    const results = [];
    if (questionObj.record_speak && questionObj.record_speak.length > 0) {
        const items = questionObj.record_speak
            .filter(item => item.content && item.content.length > 100)
            .map(item => cleanHtmlText(item.content));
        if (items.length > 0) {
            results.push({ question: '转述内容', answer: items.join('\n\n'), pattern: '听后转述' });
        }
    }
    return results;
}

function parseReadingContent(questionObj) {
    const results = [];
    if (questionObj.record_follow_read) {
        const content = cleanHtmlText(questionObj.record_follow_read);
        if (content) results.push({ question: '朗读短文', answer: content, pattern: '朗读短文' });
    }
    if (results.length === 0 && questionObj.analysis) {
        const content = cleanHtmlText(questionObj.analysis);
        if (content && /\/\//.test(content)) {
            results.push({ question: '朗读短文', answer: content.replace(/\/\//g, '，'), pattern: '朗读短文' });
        }
    }
    return results;
}

function parseFallback(questionObj) {
    const results = [];
    if (questionObj.answer_text) {
        results.push({ question: '问题', answer: questionObj.answer_text, pattern: '未知题型' });
    }
    if (questionObj.record_speak && questionObj.record_speak.length > 0) {
        questionObj.record_speak.forEach((item, index) => {
            if (item.content && item.content !== '<answers/>') {
                results.push({ question: `第${index + 1}项`, answer: cleanHtmlText(item.content), pattern: '未知题型' });
            }
        });
    }
    return results;
}

function extractFromJSON(content) {
    const answers = [];
    try {
        let jsonData;
        try { jsonData = JSON.parse(content); } catch (e) { return []; }
        if (jsonData.Data && jsonData.Data.sentences) {
            jsonData.Data.sentences.forEach((sentence, index) => {
                if (sentence.text && sentence.text.length > 2) {
                    answers.push({ question: `第${index + 1}题`, answer: sentence.text, pattern: '句子跟读' });
                }
            });
        }
        if (jsonData.Data && jsonData.Data.words) {
            jsonData.Data.words.forEach((word, index) => {
                if (word && word.length > 1) {
                    answers.push({ question: `第${index + 1}题`, answer: word, pattern: '单词发音' });
                }
            });
        }
        if (jsonData.questionObj) answers.push(...parseQuestionFile(jsonData));
        if (Array.isArray(jsonData.answers)) {
            jsonData.answers.forEach((answer, index) => {
                if (answer && (typeof answer === 'string' || (typeof answer === 'object' && answer.content))) {
                    const answerText = typeof answer === 'string' ? answer : (answer.content || answer.answer || '');
                    answers.push({ question: `第${index + 1}题`, answer: answerText, pattern: '答案数组' });
                }
            });
        }
        if (jsonData.questions) {
            jsonData.questions.forEach((question, index) => {
                if (question && question.answer) {
                    answers.push({ question: question.question || `第${index + 1}题`, answer: question.answer, pattern: '题目模式' });
                }
            });
        }
    } catch (e) { return []; }
    return answers;
}

function extractFromXML(content, fileName) {
    const answers = [];
    try {
        if (fileName && fileName.toLowerCase().includes('correctanswer')) {
            const elementMatches = [...content.matchAll(/<element\s+id="([^"]+)"[^>]*>(.*?)<\/element>/gs)];
            elementMatches.forEach((elementMatch, index) => {
                const elementContent = elementMatch[2];
                if (!elementContent.trim()) return;
                const answersMatch = elementContent.match(/<answers>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/answers>/);
                if (answersMatch && answersMatch[1]) {
                    answers.push({ question: `第${index + 1}题`, answer: answersMatch[1].trim(), pattern: 'XML正确答案' });
                } else {
                    const answerMatches = [...elementContent.matchAll(/<answer[^>]*>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/answer>/g)];
                    if (answerMatches.length > 0) {
                        answers.push({
                            question: `第${index + 1}题`,
                            answer: answerMatches.map(m => m[1].trim()).filter(t => t).join(' / '),
                            pattern: 'XML正确答案'
                        });
                    }
                }
            });
        }
        if (fileName && fileName.toLowerCase().includes('paper')) {
            const elementMatches = [...content.matchAll(/<element[^>]*id="([^"]+)"[^>]*>(.*?)<\/element>/gs)];
            elementMatches.forEach((elementMatch) => {
                const elementContent = elementMatch[2];
                const questionNoMatch = elementContent.match(/<question_no>(\d+)<\/question_no>/);
                const questionTextMatch = elementContent.match(/<question_text>\s*<!\[CDATA\[(.*?)]]>\s*<\/question_text>/s);
                if (questionNoMatch && questionTextMatch) {
                    const questionNo = parseInt(questionNoMatch[1]);
                    let questionText = cleanHtmlText(questionTextMatch[1]).replace(/\{\{\d+\}\}/g, ' ');
                    answers.push({ question: `第${questionNo}题`, answer: questionText, pattern: 'XML题目' });
                }
            });
        }
    } catch (error) { console.error('extractFromXML failed:', error); }
    return answers;
}

function extractFromText(content) {
    const answers = [];
    try {
        const patterns = [
            /答案\s*[:：]\s*([^\n]+)/g,
            /标准答案\s*[:：]\s*([^\n]+)/g,
            /正确答案\s*[:：]\s*([^\n]+)/g,
            /参考答案\s*[:：]\s*([^\n]+)/g
        ];
        content.split('\n').forEach((line, lineNum) => {
            patterns.forEach(pattern => {
                const matches = [...line.matchAll(pattern)];
                matches.forEach(match => {
                    if (match[1] && match[1].trim()) {
                        answers.push({ question: `文本-${lineNum + 1}`, answer: match[1].trim(), pattern: '文本答案' });
                    }
                });
            });
        });
    } catch (e) { return []; }
    return answers;
}

function processFileContent(content, fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.json')) return extractFromJSON(content);
    if (lowerName.endsWith('.js')) {
        const varMatch = content.match(/var\s+pageConfig\s*=\s*({.+?});?$/s);
        if (varMatch && varMatch[1]) {
            try { return parseQuestionFile(JSON.parse(varMatch[1])); } catch (e) {}
        }
        try { return parseQuestionFile(JSON.parse(content)); } catch (e) { return []; }
    }
    if (lowerName.endsWith('.xml')) return extractFromXML(content, fileName);
    if (lowerName.endsWith('.txt')) return extractFromText(content);
    return [];
}

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
        for (const u3encFile of u3encFiles) {
            try {
                const encryptedData = fs.readFileSync(u3encFile);
                const decryptedData = decryptU3enc(encryptedData);
                if (decryptedData) {
                    const content = decryptedData.toString('utf-8');
                    const jsonStr = extractJsonFromPageConfig(content);
                    if (jsonStr) {
                        const pageConfig = JSON.parse(jsonStr);
                        const fileAnswers = extractFromPage1(pageConfig);
                        allAnswers.push(...fileAnswers);
                    }
                }
            } catch (error) {
                console.error(`u3enc process failed: ${u3encFile}`, error);
            }
        }

        const answerFiles = findAnswerFiles(extractDir);
        for (const filePath of answerFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const fileName = path.basename(filePath);
                const fileAnswers = processFileContent(content, fileName);
                allAnswers.push(...fileAnswers);
            } catch (error) {
                console.error(`file process failed: ${filePath}`, error);
            }
        }

        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}
    } catch (error) {
        console.error('processZipFile failed:', error);
    }
    return deduplicateAnswers(allAnswers);
}

function processDirectory(dirPath) {
    const allAnswers = [];
    try {
        const u3encFiles = findU3encFiles(dirPath);
        for (const u3encFile of u3encFiles) {
            try {
                const encryptedData = fs.readFileSync(u3encFile);
                const decryptedData = decryptU3enc(encryptedData);
                if (decryptedData) {
                    const content = decryptedData.toString('utf-8');
                    const jsonStr = extractJsonFromPageConfig(content);
                    if (jsonStr) {
                        const pageConfig = JSON.parse(jsonStr);
                        allAnswers.push(...extractFromPage1(pageConfig));
                    }
                }
            } catch (error) {
                console.error(`u3enc process failed: ${u3encFile}`, error);
            }
        }

        const answerFiles = findAnswerFiles(dirPath);
        for (const filePath of answerFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const fileName = path.basename(filePath);
                allAnswers.push(...processFileContent(content, fileName));
            } catch (error) {
                console.error(`file process failed: ${filePath}`, error);
            }
        }
    } catch (error) {
        console.error('processDirectory failed:', error);
    }
    return deduplicateAnswers(allAnswers);
}

function deduplicateAnswers(answers) {
    const seen = new Set();
    return answers.filter(ans => {
        const key = `${ans.question}|${ans.answer}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

cordova.channel.on('process-zip', async (zipPath) => {
    try {
        const answers = await processZipFile(zipPath);
        cordova.channel.post('process-result', { success: true, answers, source: zipPath });
    } catch (error) {
        cordova.channel.post('process-result', { success: false, error: error.message, source: zipPath });
    }
});

cordova.channel.on('process-directory', (dirPath) => {
    try {
        const answers = processDirectory(dirPath);
        cordova.channel.post('process-result', { success: true, answers, source: dirPath });
    } catch (error) {
        cordova.channel.post('process-result', { success: false, error: error.message, source: dirPath });
    }
});

cordova.channel.on('process-file', (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath);
        let answers = [];

        if (fileName.toLowerCase().endsWith('.u3enc')) {
            const encryptedData = fs.readFileSync(filePath);
            const decryptedData = decryptU3enc(encryptedData);
            if (decryptedData) {
                const text = decryptedData.toString('utf-8');
                const jsonStr = extractJsonFromPageConfig(text);
                if (jsonStr) {
                    try { answers = extractFromPage1(JSON.parse(jsonStr)); } catch (e) {}
                }
            }
        } else {
            answers = processFileContent(content, fileName);
        }

        cordova.channel.post('process-result', { success: true, answers, source: filePath });
    } catch (error) {
        cordova.channel.post('process-result', { success: false, error: error.message, source: filePath });
    }
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
