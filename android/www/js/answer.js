class AnswerExtractor {
    constructor() {
        this.cryptoManager = new CryptoManager();
    }

    cleanHtmlText(text) {
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

    extractJsonFromPageConfig(content) {
        const match = content.match(/var\s+pageConfig\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
        if (match && match[1]) return match[1];
        const startIndex = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (startIndex !== -1 && lastBrace !== -1 && lastBrace > startIndex) {
            return content.substring(startIndex, lastBrace + 1);
        }
        return null;
    }

    extractFromPage1(pageConfig) {
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
                            const questionText = this.cleanHtmlText(question.question_text || '');
                            const answerContent = this.cleanHtmlText(correctOption.content?.trim() || '');
                            answers.push({
                                question: questionText || '未知问题',
                                answer: `${question.answer_text}. ${answerContent}`,
                                pattern: '听后选择'
                            });
                        }
                    }
                    if (question.questions_list && question.questions_list.length > 0) {
                        for (const q of question.questions_list) {
                            if (q.answer_text && q.options && q.options.length > 0) {
                                const correctOption = q.options.find(opt => opt.id === q.answer_text);
                                if (correctOption) {
                                    const questionText = this.cleanHtmlText(q.question_text || '');
                                    const answerContent = this.cleanHtmlText(correctOption.content?.trim() || '');
                                    answers.push({
                                        question: questionText || '未知问题',
                                        answer: `${q.answer_text}. ${answerContent}`,
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
                                    question: this.cleanHtmlText(question.question_text || '口语跟读'),
                                    answer: this.cleanHtmlText(item.content.trim()),
                                    pattern: '口语跟读'
                                });
                            }
                        }
                    }
                    if (qtypeId === 449 && question.analysis && question.analysis.trim()) {
                        const analysisText = this.cleanHtmlText(question.analysis).trim();
                        if (analysisText) {
                            answers.push({
                                question: '朗读文本',
                                answer: analysisText,
                                pattern: '朗读'
                            });
                        }
                    }
                    if (qtypeId === 554 && question.analysis && question.analysis.trim()) {
                        let analysisText = question.analysis
                            .replace(/<p[^>]*>答案[一二三四五六七八九十]+：<\/p>/g, '')
                            .replace(/<[^>]+>/g, '')
                            .trim();
                        analysisText = analysisText.replace(/\s+/g, ' ').trim();
                        if (analysisText) {
                            const firstAnswer = analysisText.split(/\s*答案[一二三四五六七八九十]+：\s*/)[0] || analysisText;
                            answers.push({
                                question: this.cleanHtmlText(question.question_text || '故事复述'),
                                answer: firstAnswer.trim(),
                                pattern: '故事复述'
                            });
                        }
                    }
                    if (qtypeId === 503) {
                        if (question.analysis && question.analysis.trim()) {
                            const analysisText = this.cleanHtmlText(question.analysis).trim();
                            if (analysisText) {
                                answers.push({
                                    question: this.cleanHtmlText(question.question_text || '听力填空'),
                                    answer: analysisText,
                                    pattern: '听力填空'
                                });
                            }
                        } else if (question.record_follow_read?.paragraph_list) {
                            for (const para of question.record_follow_read.paragraph_list) {
                                for (const sent of (para.sentences || [])) {
                                    if (sent.keyNo && sent.content_en) {
                                        const boldMatch = sent.content_en.match(/<b>([^<]+)<\/b>/);
                                        const answerText = boldMatch ? boldMatch[1] : this.cleanHtmlText(sent.content_en);
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
            return answers;
        } catch (error) {
            console.error('extractFromPage1 failed:', error);
            return [];
        }
    }

    detectExactType(questionObj) {
        if ((questionObj.questions_list && questionObj.questions_list.length > 0 &&
            questionObj.questions_list[0].options && questionObj.questions_list[0].options.length > 0) ||
            (questionObj.options && questionObj.options.length > 0 && questionObj.answer_text)) {
            return '听后选择';
        }
        if (this.hasAnswerAttributes(questionObj)) return '听后回答';
        if (questionObj.record_speak && questionObj.record_speak.length > 0) {
            const firstItem = questionObj.record_speak[0];
            if (firstItem && !firstItem.work && !firstItem.show &&
                firstItem.content && firstItem.content.length > 100) {
                return '听后转述';
            }
        }
        if (questionObj.record_follow_read ||
            (questionObj.analysis && /\/\//.test(questionObj.analysis))) {
            return '朗读短文';
        }
        return '未知';
    }

    hasAnswerAttributes(questionObj) {
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

    parseChoiceQuestions(questionObj) {
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
                    question: `第1题: ${this.cleanHtmlText(questionObj.question_text || '未知问题')}`,
                    answer: `${questionObj.answer_text}. ${correctOption.content?.trim() || ''}`,
                    pattern: '听后选择'
                });
            }
        }
        return results;
    }

    parseAnswerQuestions(questionObj) {
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

    parseRetellContent(questionObj) {
        const results = [];
        if (questionObj.record_speak && questionObj.record_speak.length > 0) {
            const items = questionObj.record_speak
                .filter(item => item.content && item.content.length > 100)
                .map(item => this.cleanHtmlText(item.content));
            if (items.length > 0) {
                results.push({
                    question: '转述内容',
                    answer: items.join('\n\n'),
                    pattern: '听后转述'
                });
            }
        }
        return results;
    }

    parseReadingContent(questionObj) {
        const results = [];
        if (questionObj.record_follow_read) {
            const content = this.cleanHtmlText(questionObj.record_follow_read);
            if (content) {
                results.push({
                    question: '朗读短文',
                    answer: content,
                    pattern: '朗读短文'
                });
            }
        }
        if (results.length === 0 && questionObj.analysis) {
            const content = this.cleanHtmlText(questionObj.analysis);
            if (content && /\/\//.test(content)) {
                results.push({
                    question: '朗读短文',
                    answer: content.replace(/\/\//g, '，'),
                    pattern: '朗读短文'
                });
            }
        }
        return results;
    }

    parseFallback(questionObj) {
        const results = [];
        if (questionObj.answer_text) {
            results.push({
                question: '问题',
                answer: questionObj.answer_text,
                pattern: '未知题型'
            });
        }
        if (questionObj.record_speak && questionObj.record_speak.length > 0) {
            questionObj.record_speak.forEach((item, index) => {
                if (item.content && item.content !== '<answers/>') {
                    results.push({
                        question: `第${index + 1}项`,
                        answer: this.cleanHtmlText(item.content),
                        pattern: '未知题型'
                    });
                }
            });
        }
        return results;
    }

    parseQuestionFile(fileContent) {
        try {
            const config = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
            const questionObj = config.questionObj || {};
            const detectedType = this.detectExactType(questionObj);
            switch (detectedType) {
                case '听后选择': return this.parseChoiceQuestions(questionObj);
                case '听后回答': return this.parseAnswerQuestions(questionObj);
                case '听后转述': return this.parseRetellContent(questionObj);
                case '朗读短文': return this.parseReadingContent(questionObj);
                default: return this.parseFallback(questionObj);
            }
        } catch (error) {
            return [];
        }
    }

    extractFromJSON(content) {
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
            if (jsonData.questionObj) {
                answers.push(...this.parseQuestionFile(jsonData));
            }
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
                        answers.push({
                            question: question.question || `第${index + 1}题`,
                            answer: question.answer,
                            pattern: '题目模式'
                        });
                    }
                });
            }
        } catch (e) { return []; }
        return answers;
    }

    extractFromJS(content) {
        try {
            let jsonData;
            try { jsonData = JSON.parse(content); } catch (e) { return []; }
            return this.parseQuestionFile(jsonData);
        } catch (error) {
            return [];
        }
    }

    extractFromXML(content, fileName) {
        const answers = [];
        try {
            if (fileName && fileName.toLowerCase().includes('correctanswer')) {
                const elementMatches = [...content.matchAll(/<element\s+id="([^"]+)"[^>]*>(.*?)<\/element>/gs)];
                elementMatches.forEach((elementMatch, index) => {
                    const elementId = elementMatch[1];
                    const elementContent = elementMatch[2];
                    if (!elementContent.trim()) return;
                    let analysisText = '';
                    const analysisMatch = elementContent.match(/<analysis>\s*<!\[CDATA\[(.*?)]]>\s*<\/analysis>/s);
                    if (analysisMatch && analysisMatch[1]) {
                        analysisText = this.cleanHtmlText(analysisMatch[1]);
                    }
                    const answersMatch = elementContent.match(/<answers>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/answers>/);
                    if (answersMatch && answersMatch[1]) {
                        answers.push({
                            question: `第${index + 1}题`,
                            answer: answersMatch[1].trim(),
                            pattern: 'XML正确答案',
                            elementId
                        });
                    } else {
                        const answerMatches = [...elementContent.matchAll(/<answer[^>]*>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/answer>/g)];
                        if (answerMatches.length > 0) {
                            const allAnswers = answerMatches.map(m => m[1].trim()).filter(t => t);
                            answers.push({
                                question: `第${index + 1}题`,
                                answer: allAnswers.join(' / '),
                                pattern: 'XML正确答案',
                                elementId
                            });
                        }
                    }
                });
            }
            if (fileName && fileName.toLowerCase().includes('paper')) {
                const elementMatches = [...content.matchAll(/<element[^>]*id="([^"]+)"[^>]*>(.*?)<\/element>/gs)];
                elementMatches.forEach((elementMatch) => {
                    const elementId = elementMatch[1];
                    const elementContent = elementMatch[2];
                    const questionNoMatch = elementContent.match(/<question_no>(\d+)<\/question_no>/);
                    const questionTextMatch = elementContent.match(/<question_text>\s*<!\[CDATA\[(.*?)]]>\s*<\/question_text>/s);
                    if (questionNoMatch && questionTextMatch) {
                        const questionNo = parseInt(questionNoMatch[1]);
                        let questionText = this.cleanHtmlText(questionTextMatch[1]).replace(/\{\{\d+\}\}/g, ' ');
                        const optionsMatches = [...elementContent.matchAll(/<option\s+id="([^"]+)"\s*[^>]*>\s*<!\[CDATA\[(.*?)]]>\s*<\/option>/gs)];
                        const options = optionsMatches.map(m => ({ id: m[1], text: m[2].trim() }));
                        answers.push({
                            question: `第${questionNo}题`,
                            answer: questionText,
                            pattern: options.length > 0 ? 'XML题目选项' : 'XML题目',
                            elementId,
                            questionNo,
                            options
                        });
                    }
                });
            }
        } catch (error) {
            console.error('extractFromXML failed:', error);
        }
        return answers;
    }

    extractFromText(content) {
        const answers = [];
        try {
            const patterns = [
                /答案\s*[:：]\s*([^\n]+)/g,
                /标准答案\s*[:：]\s*([^\n]+)/g,
                /正确答案\s*[:：]\s*([^\n]+)/g,
                /参考答案\s*[:：]\s*([^\n]+)/g
            ];
            const lines = content.split('\n');
            lines.forEach((line, lineNum) => {
                patterns.forEach(pattern => {
                    const matches = [...line.matchAll(pattern)];
                    matches.forEach(match => {
                        if (match[1] && match[1].trim()) {
                            answers.push({
                                question: `文本-${lineNum + 1}`,
                                answer: match[1].trim(),
                                pattern: '文本答案'
                            });
                        }
                    });
                });
            });
        } catch (error) { return []; }
        return answers;
    }

    async processU3encFile(fileEntry, dirPath) {
        const answers = [];
        try {
            const content = await this.readFileEntry(fileEntry);
            const encryptedData = new Uint8Array(content);
            const decryptedData = await this.cryptoManager.decryptU3enc(encryptedData);
            if (!decryptedData) return [];
            const text = this.cryptoManager.arrayBufferToString(decryptedData);
            const jsonStr = this.extractJsonFromPageConfig(text);
            if (jsonStr) {
                const pageConfig = JSON.parse(jsonStr);
                return this.extractFromPage1(pageConfig);
            }
        } catch (error) {
            console.error('processU3encFile failed:', error);
        }
        return answers;
    }

    async processFile(fileEntry) {
        const answers = [];
        const fileName = fileEntry.name.toLowerCase();
        try {
            const content = await this.readFileEntryText(fileEntry);
            if (fileName.endsWith('.json')) {
                return this.extractFromJSON(content);
            } else if (fileName.endsWith('.js')) {
                if (fileName.endsWith('.u3enc')) {
                    const encContent = await this.readFileEntry(fileEntry);
                    const encryptedData = new Uint8Array(encContent);
                    const decryptedData = await this.cryptoManager.decryptU3enc(encryptedData);
                    if (decryptedData) {
                        const text = this.cryptoManager.arrayBufferToString(decryptedData);
                        const jsonStr = this.extractJsonFromPageConfig(text);
                        if (jsonStr) {
                            try {
                                const pageConfig = JSON.parse(jsonStr);
                                return this.extractFromPage1(pageConfig);
                            } catch (e) {}
                        }
                    }
                    return [];
                }
                return this.extractFromJS(content);
            } else if (fileName.endsWith('.xml')) {
                return this.extractFromXML(content, fileEntry.name);
            } else if (fileName.endsWith('.txt')) {
                return this.extractFromText(content);
            }
        } catch (error) {
            console.error('processFile failed:', error);
        }
        return answers;
    }

    async scanDirectoryForAnswers(dirEntry, logCallback) {
        const allAnswers = [];
        const processedFiles = [];
        const u3encFiles = [];
        const otherFiles = [];

        await this._collectFiles(dirEntry, u3encFiles, otherFiles, '');

        if (u3encFiles.length > 0 && logCallback) {
            logCallback(`找到 ${u3encFiles.length} 个 u3enc 文件`, 'info');
        }

        for (const file of u3encFiles) {
            try {
                const fileAnswers = await this.processFile(file.entry);
                if (fileAnswers.length > 0) {
                    allAnswers.push(...fileAnswers.map(a => ({ ...a, sourceFile: file.relativePath })));
                    processedFiles.push({ file: file.relativePath, count: fileAnswers.length });
                    if (logCallback) logCallback(`${file.relativePath}: ${fileAnswers.length} 个答案`, 'success');
                }
            } catch (error) {
                if (logCallback) logCallback(`${file.relativePath}: 处理失败`, 'error');
            }
        }

        for (const file of otherFiles) {
            const name = file.entry.name.toLowerCase();
            if (!name.endsWith('.json') && !name.endsWith('.js') && !name.endsWith('.xml') && !name.endsWith('.txt')) continue;
            if (!name.includes('answer') && !name.includes('paper') && !name.includes('question') && !name.includes('questiondata')) continue;
            try {
                const fileAnswers = await this.processFile(file.entry);
                if (fileAnswers.length > 0) {
                    allAnswers.push(...fileAnswers.map(a => ({ ...a, sourceFile: file.relativePath })));
                    processedFiles.push({ file: file.relativePath, count: fileAnswers.length });
                    if (logCallback) logCallback(`${file.relativePath}: ${fileAnswers.length} 个答案`, 'success');
                }
            } catch (error) {
                if (logCallback) logCallback(`${file.relativePath}: 处理失败`, 'error');
            }
        }

        return this.deduplicateAnswers(allAnswers);
    }

    async _collectFiles(dirEntry, u3encFiles, otherFiles, basePath) {
        const reader = dirEntry.createReader();
        const entries = await new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
        });
        for (const entry of entries) {
            const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
            if (entry.isDirectory) {
                await this._collectFiles(entry, u3encFiles, otherFiles, entryPath);
            } else if (entry.isFile) {
                if (entry.name.toLowerCase() === 'page1.js.u3enc') {
                    u3encFiles.push({ entry, relativePath: entryPath });
                } else {
                    otherFiles.push({ entry, relativePath: entryPath });
                }
            }
        }
    }

    deduplicateAnswers(answers) {
        const seen = new Set();
        return answers.filter(ans => {
            const key = `${ans.question}|${ans.answer}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    readFileEntry(fileEntry) {
        return new Promise((resolve, reject) => {
            fileEntry.file(file => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            }, reject);
        });
    }

    readFileEntryText(fileEntry) {
        return new Promise((resolve, reject) => {
            fileEntry.file(file => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(file);
            }, reject);
        });
    }

    async processFileContent(content, fileName) {
        const answers = [];
        try {
            if (fileName.endsWith('.json')) {
                return this.extractFromJSON(content);
            } else if (fileName.endsWith('.js')) {
                if (fileName.endsWith('.u3enc')) {
                    return [];
                }
                return this.extractFromJS(content);
            } else if (fileName.endsWith('.xml')) {
                return this.extractFromXML(content, fileName);
            } else if (fileName.endsWith('.txt')) {
                return this.extractFromText(content);
            }
        } catch (error) {
            console.error('processFileContent failed:', error);
        }
        return answers;
    }

    async scanDirectoryForAnswersNative(dirPath, logCallback, flipbookScanner) {
        const allAnswers = [];
        const u3encFiles = [];
        const otherFiles = [];

        await this._collectFilesNative(dirPath, u3encFiles, otherFiles, '', flipbookScanner);

        if (u3encFiles.length > 0 && logCallback) {
            logCallback('找到 ' + u3encFiles.length + ' 个 u3enc 文件', 'info');
        }

        for (const file of u3encFiles) {
            if (logCallback) logCallback(file.relativePath + ': 需要解密', 'warning');
        }

        for (const file of otherFiles) {
            const name = file.name.toLowerCase();
            if (!name.endsWith('.json') && !name.endsWith('.js') && !name.endsWith('.xml') && !name.endsWith('.txt')) continue;
            try {
                var fileData = await new Promise((resolve) => {
                    flipbookScanner.readFile(file.path, (result) => resolve(result), () => resolve(null));
                });
                if (!fileData || !fileData.content) continue;
                const fileAnswers = await this.processFileContent(fileData.content, name);
                if (fileAnswers.length > 0) {
                    allAnswers.push(...fileAnswers.map(a => ({ ...a, sourceFile: file.relativePath })));
                    if (logCallback) logCallback(file.relativePath + ': ' + fileAnswers.length + ' 个答案', 'success');
                }
            } catch (error) {
                if (logCallback) logCallback(file.relativePath + ': 处理失败', 'error');
            }
        }

        return this.deduplicateAnswers(allAnswers);
    }

    async _collectFilesNative(dirPath, u3encFiles, otherFiles, basePath, flipbookScanner) {
        var app = this;
        var entries = await new Promise((resolve) => {
            flipbookScanner.listFiles(dirPath, (result) => resolve(result), () => resolve([]));
        });
        for (const entry of entries) {
            var entryPath = basePath ? basePath + '/' + entry.name : entry.name;
            if (entry.isDirectory) {
                await app._collectFilesNative(entry.path, u3encFiles, otherFiles, entryPath, flipbookScanner);
            } else if (entry.isFile) {
                if (entry.name.toLowerCase() === 'page1.js.u3enc') {
                    u3encFiles.push({ path: entry.path, name: entry.name, relativePath: entryPath });
                } else {
                    otherFiles.push({ path: entry.path, name: entry.name, relativePath: entryPath });
                }
            }
        }
    }
}

window.AnswerExtractor = AnswerExtractor;
