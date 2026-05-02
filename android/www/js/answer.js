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

    _extractJsonFromPageConfig(content) {
        const match = content.match(/var\s+pageConfig\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
        if (match && match[1]) return match[1];
        const startIndex = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (startIndex !== -1 && lastBrace !== -1 && lastBrace > startIndex) {
            return content.substring(startIndex, lastBrace + 1);
        }
        return null;
    }

    _extractMediaIndexFromContent(content) {
        try {
            const match = content.match(/media\/(?:[A-Za-z0-9]+-)?([TAQ])?(\d+)(?:\.(\d+))?(?:-[^.]*)?\.mp3/i);
            if (match && match[2]) {
                const prefix = match[1] ? match[1].toUpperCase() : 'T';
                const mainIndex = parseInt(match[2]);
                const subIndex = match[3] ? parseInt(match[3]) : 0;
                const prefixPriority = { 'T': 1, 'A': 2, 'Q': 3 };
                return (prefixPriority[prefix] || 1) * 10000 + mainIndex * 10 + subIndex;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    _extractFromPage1(pageConfig) {
        const answers = [];
        try {
            if (!pageConfig || !pageConfig.slides) return answers;

            for (const slide of pageConfig.slides) {
                const questionList = slide.questionList || [];
                for (const question of questionList) {
                    const qtypeId = question.qtype_id;
                    const mediaIndex = this._extractMediaIndexFromContent(question.media?.file || '');

                    if (question.answer_text && question.options && question.options.length > 0) {
                        const correctOption = question.options.find(opt => opt.id === question.answer_text);
                        if (correctOption) {
                            const questionText = this.cleanHtmlText(question.question_text || '');
                            const answerContent = this.cleanHtmlText(correctOption.content?.trim() || '');
                            answers.push({
                                question: questionText || '未知问题',
                                answer: `${question.answer_text}. ${answerContent}`,
                                content: `请回答: ${question.answer_text}. ${answerContent}`,
                                questionText: questionText,
                                pattern: '听后选择',
                                mediaIndex: mediaIndex
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
                                        content: `请回答: ${q.answer_text}. ${answerContent}`,
                                        questionText: questionText,
                                        pattern: '听后选择-嵌套',
                                        mediaIndex: this._extractMediaIndexFromContent(q.media?.file || '')
                                    });
                                }
                            }
                        }
                    }

                    if (qtypeId === 237 && question.record_speak && question.record_speak.length > 0) {
                        const correctAnswers = question.record_speak.filter(item => item.work === "1" && item.show === "1");
                        for (const item of correctAnswers) {
                            if (item.content && item.content.trim()) {
                                const questionText = this.cleanHtmlText(question.question_text || '口语跟读');
                                const answerContent = this.cleanHtmlText(item.content.trim());
                                answers.push({
                                    question: questionText,
                                    answer: answerContent,
                                    content: `请回答: ${answerContent}`,
                                    questionText: questionText,
                                    pattern: '口语跟读',
                                    mediaIndex: mediaIndex
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
                                content: `请朗读: ${analysisText}`,
                                questionText: analysisText.substring(0, 50) + (analysisText.length > 50 ? '...' : ''),
                                pattern: '朗读',
                                mediaIndex: mediaIndex
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
                            const questionText = this.cleanHtmlText(question.question_text || '故事复述');
                            answers.push({
                                question: questionText,
                                answer: firstAnswer.trim(),
                                content: `请复述: ${firstAnswer.trim()}`,
                                questionText: questionText,
                                pattern: '故事复述',
                                mediaIndex: mediaIndex
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
                                    content: `请回答: ${analysisText}`,
                                    questionText: this.cleanHtmlText(question.question_text || '听力填空'),
                                    pattern: '听力填空',
                                    mediaIndex: mediaIndex
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
                                                content: `请回答: ${answerText.trim()}`,
                                                questionText: answerText.trim(),
                                                pattern: '听力填空',
                                                mediaIndex: mediaIndex
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

    _sortAndDeduplicateAnswers(answers, sourceMode = 'page1') {
        if (!answers || answers.length === 0) return answers;

        let sortedAnswers;
        if (sourceMode === 'page1' || sourceMode === 'mixed') {
            sortedAnswers = [...answers];
        } else {
            sortedAnswers = [...answers].sort((a, b) => {
                const indexA = a.mediaIndex !== undefined && a.mediaIndex !== null ? a.mediaIndex : Infinity;
                const indexB = b.mediaIndex !== undefined && b.mediaIndex !== null ? b.mediaIndex : Infinity;
                return indexA - indexB;
            });
        }

        const seen = new Map();
        const deduplicated = [];
        for (const ans of sortedAnswers) {
            const key = `${ans.questionText || ans.question}|${ans.answer}`;
            if (!seen.has(key)) {
                seen.set(key, true);
                deduplicated.push(ans);
            }
        }
        return deduplicated;
    }

    _detectExactType(questionObj) {
        if ((questionObj.questions_list && questionObj.questions_list.length > 0 &&
            questionObj.questions_list[0].options && questionObj.questions_list[0].options.length > 0) ||
            (questionObj.options && questionObj.options.length > 0 && questionObj.answer_text)) {
            return '听后选择';
        }
        if (this._hasAnswerAttributes(questionObj)) return '听后回答';
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

    _hasAnswerAttributes(questionObj) {
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

    _parseChoiceQuestions(questionObj, mediaIndex) {
        const results = [];
        if (questionObj.questions_list) {
            questionObj.questions_list.forEach((question, index) => {
                if (question.answer_text && question.options) {
                    const correctOption = question.options.find(opt => opt.id === question.answer_text);
                    if (correctOption) {
                        results.push({
                            question: `第${index + 1}题: ${question.question_text || '未知问题'}`,
                            answer: `${question.answer_text}. ${correctOption.content?.trim() || ''}`,
                            content: `请回答: ${question.answer_text}. ${correctOption.content?.trim() || ''}`,
                            questionText: question.question_text || '',
                            pattern: '听后选择',
                            mediaIndex: mediaIndex
                        });
                    }
                }
            });
        }
        if (results.length === 0 && questionObj.options && questionObj.options.length > 0 && questionObj.answer_text) {
            const correctOption = questionObj.options.find(opt => opt.id === questionObj.answer_text);
            if (correctOption) {
                const cleanQuestionText = this.cleanHtmlText(questionObj.question_text || '未知问题');
                results.push({
                    question: `第1题: ${cleanQuestionText}`,
                    answer: `${questionObj.answer_text}. ${correctOption.content?.trim() || ''}`,
                    content: `请回答: ${questionObj.answer_text}. ${correctOption.content?.trim() || ''}`,
                    questionText: cleanQuestionText,
                    pattern: '听后选择',
                    mediaIndex: mediaIndex
                });
            }
        }
        return results;
    }

    _parseAnswerQuestions(questionObj, mediaIndex) {
        const results = [];
        if (questionObj.questions_list) {
            questionObj.questions_list.forEach((question, qIndex) => {
                if (question.record_speak) {
                    const answers = question.record_speak
                        .filter(item => item.show === "1" || item.show === 1)
                        .map(item => item.content?.trim() || '')
                        .filter(content => content && content !== '<answers/>');
                    let messageInfo = {
                        question: `第${qIndex + 1}题`,
                        answer: question.question_text || '未知',
                        content: `点击展开全部回答`,
                        pattern: '听后回答',
                        mediaIndex: mediaIndex,
                        children: []
                    };
                    answers.forEach((answer, aIndex) => {
                        messageInfo.children.push({
                            question: `第${aIndex + 1}个答案`,
                            answer: answer,
                            content: `请回答: ${answer}`,
                            pattern: '听后回答'
                        });
                    });
                    results.push(messageInfo);
                }
            });
        }
        if (questionObj.record_speak && results.length === 0) {
            const answers = questionObj.record_speak
                .filter(item => item.show === "1" || item.show === 1)
                .map(item => item.content?.trim() || '')
                .filter(content => content && content !== '<answers/>');
            let messageInfo = {
                question: `第1题`,
                answer: questionObj.question_text || '未知',
                content: `点击展开全部回答`,
                pattern: '听后回答',
                mediaIndex: mediaIndex,
                children: []
            };
            answers.forEach((answer, index) => {
                messageInfo.children.push({
                    question: `第${index + 1}个答案`,
                    answer: answer,
                    content: `请回答: ${answer}`,
                    pattern: '听后回答'
                });
            });
            results.push(messageInfo);
        }
        return results;
    }

    _parseRetellContent(questionObj, mediaIndex) {
        const results = [];
        if (questionObj.record_speak && questionObj.record_speak.length > 0) {
            const items = questionObj.record_speak
                .filter(item => item.content && item.content.length > 100)
                .map(item => this.cleanHtmlText(item.content));
            if (items.length > 0) {
                const fullContent = items.join('\n\n');
                results.push({
                    question: '转述内容',
                    answer: fullContent,
                    content: `请转述: ${fullContent.substring(0, 100)}...`,
                    questionText: '请根据听力内容进行转述',
                    pattern: '听后转述',
                    mediaIndex: mediaIndex
                });
            }
        }
        return results;
    }

    _parseReadingContent(questionObj, mediaIndex) {
        const results = [];
        if (questionObj.record_follow_read) {
            const content = this.cleanHtmlText(questionObj.record_follow_read);
            if (content) {
                results.push({
                    question: '朗读短文',
                    answer: content,
                    content: `请朗读: ${content}`,
                    questionText: '请朗读以下短文',
                    pattern: '朗读短文',
                    mediaIndex: mediaIndex
                });
            }
        }
        if (results.length === 0 && questionObj.analysis) {
            const content = this.cleanHtmlText(questionObj.analysis);
            if (content && /\/\//.test(content)) {
                results.push({
                    question: '朗读短文',
                    answer: content.replace(/\/\//g, '，'),
                    content: `请朗读: ${content.replace(/\/\//g, '，')}`,
                    questionText: '请朗读以下短文',
                    pattern: '朗读短文',
                    mediaIndex: mediaIndex
                });
            }
        }
        return results;
    }

    _parseFallback(questionObj, mediaIndex) {
        const results = [];
        if (questionObj.answer_text) {
            results.push({
                question: '问题',
                answer: questionObj.answer_text,
                content: `答案: ${questionObj.answer_text}`,
                questionText: questionObj.answer_text,
                pattern: '未知题型',
                mediaIndex: mediaIndex
            });
        }
        if (questionObj.record_speak && questionObj.record_speak.length > 0) {
            questionObj.record_speak.forEach((item, index) => {
                if (item.content && item.content !== '<answers/>') {
                    results.push({
                        question: `第${index + 1}项`,
                        answer: this.cleanHtmlText(item.content),
                        content: `请回答: ${this.cleanHtmlText(item.content)}`,
                        questionText: this.cleanHtmlText(item.content),
                        pattern: '未知题型',
                        mediaIndex: mediaIndex
                    });
                }
            });
        }
        return results;
    }

    _parseQuestionFile(fileContent, mediaIndex) {
        try {
            const config = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
            const questionObj = config.questionObj || {};
            const detectedType = this._detectExactType(questionObj);
            switch (detectedType) {
                case '听后选择': return this._parseChoiceQuestions(questionObj, mediaIndex);
                case '听后回答': return this._parseAnswerQuestions(questionObj, mediaIndex);
                case '听后转述': return this._parseRetellContent(questionObj, mediaIndex);
                case '朗读短文': return this._parseReadingContent(questionObj, mediaIndex);
                default: return this._parseFallback(questionObj, mediaIndex);
            }
        } catch (error) {
            return [];
        }
    }

    extractFromJSON(content) {
        const answers = [];
        const mediaIndex = this._extractMediaIndexFromContent(content);
        try {
            let jsonData;
            try { jsonData = JSON.parse(content); } catch (e) { return []; }

            if (jsonData.Data && jsonData.Data.sentences) {
                jsonData.Data.sentences.forEach((sentence, index) => {
                    if (sentence.text && sentence.text.length > 2) {
                        answers.push({
                            question: `第${index + 1}题`,
                            answer: sentence.text,
                            content: `请朗读: ${sentence.text}`,
                            questionText: `请朗读: ${sentence.text}`,
                            pattern: 'JSON句子跟读',
                            mediaIndex: mediaIndex
                        });
                    }
                });
            }
            if (jsonData.Data && jsonData.Data.words) {
                jsonData.Data.words.forEach((word, index) => {
                    if (word && word.length > 1) {
                        answers.push({
                            question: `第${index + 1}题`,
                            answer: word,
                            content: `请朗读单词: ${word}`,
                            questionText: `请朗读单词: ${word}`,
                            pattern: 'JSON单词发音',
                            mediaIndex: mediaIndex
                        });
                    }
                });
            }
            if (jsonData.questionObj) {
                answers.push(...this._parseQuestionFile(jsonData, mediaIndex));
            }
            if (Array.isArray(jsonData.answers)) {
                jsonData.answers.forEach((answer, index) => {
                    if (answer && (typeof answer === 'string' || (typeof answer === 'object' && answer.content))) {
                        const answerText = typeof answer === 'string' ? answer : (answer.content || answer.answer || '');
                        answers.push({
                            question: `第${index + 1}题`,
                            answer: answerText,
                            content: answerText,
                            questionText: answerText,
                            pattern: 'JSON答案数组',
                            mediaIndex: mediaIndex
                        });
                    }
                });
            }
            if (jsonData.questions) {
                jsonData.questions.forEach((question, index) => {
                    if (question && question.answer) {
                        const questionText = question.question || `第${index + 1}题`;
                        answers.push({
                            question: questionText,
                            answer: question.answer,
                            content: `题目: ${questionText}\n答案: ${question.answer}`,
                            questionText: questionText,
                            pattern: 'JSON题目模式',
                            mediaIndex: mediaIndex
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
            const mediaIndex = this._extractMediaIndexFromContent(content);
            return this._parseQuestionFile(jsonData, mediaIndex);
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
                            content: analysisText ? `解析: ${analysisText}\n答案: ${answersMatch[1].trim()}` : `答案: ${answersMatch[1].trim()}`,
                            questionText: answersMatch[1].trim(),
                            pattern: 'XML正确答案',
                            elementId: elementId
                        });
                    } else if (analysisText) {
                        answers.push({
                            question: `第${index + 1}题`,
                            answer: analysisText,
                            content: `解析: ${analysisText}`,
                            questionText: analysisText,
                            pattern: 'XML正确答案',
                            elementId: elementId
                        });
                    } else {
                        const answerMatches = [...elementContent.matchAll(/<answer[^>]*>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/answer>/g)];
                        if (answerMatches.length > 0) {
                            const allAnswers = answerMatches.map(m => m[1].trim()).filter(t => t);
                            answers.push({
                                question: `第${index + 1}题`,
                                answer: allAnswers.join(' / '),
                                content: `答案: ${allAnswers.join(' / ')}`,
                                questionText: allAnswers.join(' / '),
                                pattern: 'XML正确答案',
                                elementId: elementId
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
                            content: `题目: ${questionText}`,
                            questionText: questionText,
                            pattern: options.length > 0 ? 'XML题目选项' : 'XML题目',
                            elementId: elementId,
                            questionNo: questionNo,
                            options: options
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
                                content: `答案: ${match[1].trim()}`,
                                questionText: match[1].trim(),
                                pattern: '文本答案'
                            });
                        }
                    });
                });
            });
        } catch (error) { return []; }
        return answers;
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
}

window.AnswerExtractor = AnswerExtractor;
