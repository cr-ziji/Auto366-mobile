class Auto366App {
    constructor() {
        this.currentView = 'home';
        this.isMonitoring = false;
        this.isFloating = false;
        this.answers = [];
        this.logs = [];
        this.logCount = 0;
        this.extractor = new AnswerExtractor();
        this.pollTimer = null;
        this.knownFiles = new Set();
        this.flipbookDirEntry = null;
        this.settings = {
            flipbookPath: '/storage/emulated/0/Android/data/com.up366.mobile/files/flipbook',
            pollInterval: 1000,
            autoStart: false,
            darkMode: null
        };
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._initAfterDOM());
        } else {
            this._initAfterDOM();
        }
    }

    _initAfterDOM() {
        this._loadSettings();
        this._initDarkMode();
        this._initEventListeners();
        this._updateUI();
        if (this.settings.autoStart) {
            setTimeout(() => this.startMonitoring(), 500);
        }
    }

    _initDarkMode() {
        const saved = this.settings.themeMode || 'auto';
        this._applyTheme(saved);
        const select = document.getElementById('themeModeSelect');
        if (select) select.value = saved;
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.settings.themeMode === 'auto') {
                this._applyTheme('auto');
            }
        });
    }

    _applyTheme(mode) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (mode === 'dark') {
            document.documentElement.classList.add('dark-mode');
        } else if (mode === 'light') {
            document.documentElement.classList.remove('dark-mode');
        } else {
            if (prefersDark) {
                document.documentElement.classList.add('dark-mode');
            } else {
                document.documentElement.classList.remove('dark-mode');
            }
        }
        this._updateAboutLogo();
    }

    _initThemeDropdown() {
        const dropdown = document.getElementById('themeDropdown');
        const btn = document.getElementById('themeDropdownBtn');
        const text = document.getElementById('themeDropdownText');
        const options = document.getElementById('themeDropdownOptions');

        if (!dropdown || !btn || !text || !options) return;

        this._setThemeDropdownValue(this.settings.themeMode || 'auto');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = options.classList.contains('show');
            if (isOpen) {
                this._closeThemeDropdown();
            } else {
                this._openThemeDropdown();
            }
        });

        options.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                const value = opt.getAttribute('data-value');
                this.settings.themeMode = value;
                this._applyTheme(value);
                this._setThemeDropdownValue(value);
                this._closeThemeDropdown();
                this._saveSettings();
            });
        });

        document.addEventListener('click', (e) => {
            if (dropdown && !dropdown.contains(e.target)) {
                this._closeThemeDropdown();
            }
        });
    }

    _setThemeDropdownValue(value) {
        const text = document.getElementById('themeDropdownText');
        const options = document.getElementById('themeDropdownOptions');
        if (!text || !options) return;

        const labels = { auto: '跟随系统', dark: '深色模式', light: '浅色模式' };
        text.textContent = labels[value] || '跟随系统';

        options.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.toggle('active', opt.getAttribute('data-value') === value);
        });
    }

    _openThemeDropdown() {
        const options = document.getElementById('themeDropdownOptions');
        const btn = document.getElementById('themeDropdownBtn');
        if (options) options.classList.add('show');
        if (btn) btn.classList.add('active');
    }

    _closeThemeDropdown() {
        const options = document.getElementById('themeDropdownOptions');
        const btn = document.getElementById('themeDropdownBtn');
        if (options) options.classList.remove('show');
        if (btn) btn.classList.remove('active');
    }

    _initEventListeners() {
        const menuToggle = document.getElementById('menuToggle');
        const menuClose = document.getElementById('menuClose');
        const menuOverlay = document.getElementById('menuOverlay');

        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMenu();
            });
        }
        if (menuClose) {
            menuClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeMenu();
            });
        }
        if (menuOverlay) {
            menuOverlay.addEventListener('click', () => this.closeMenu());
        }

        const errorMsg = document.getElementById('errorMsg');
        if (errorMsg) {
            errorMsg.addEventListener('click', () => {
                this.showView('logs');
                this.hideNotification('error');
            });
        }

        const answerMsg = document.getElementById('answerMsg');
        if (answerMsg) {
            answerMsg.addEventListener('click', () => {
                this.showView('answers');
                this.hideNotification('answer');
            });
        }

        this._initSwipeGestures();

        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.showView(item.getAttribute('data-view'));
                this.closeMenu();
            });
        });

        const toggleMonitorBtn = document.getElementById('toggleMonitorBtn');
        if (toggleMonitorBtn) {
            toggleMonitorBtn.addEventListener('click', () => this.toggleMonitoring());
        }

        const minimizeBtn = document.getElementById('minimizeBtn');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.showFloatingWindow());
        }

        const clearAnswersBtn = document.getElementById('clearAnswersBtn');
        if (clearAnswersBtn) {
            clearAnswersBtn.addEventListener('click', () => this.clearAnswers());
        }

        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }

        const copyLogsBtn = document.getElementById('copyLogsBtn');
        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', () => this.copyAllLogs());
        }

        this._initThemeDropdown();

        const autoStartMonitor = document.getElementById('autoStartMonitor');
        if (autoStartMonitor) {
            autoStartMonitor.checked = this.settings.autoStart;
            autoStartMonitor.addEventListener('change', (e) => {
                this.settings.autoStart = e.target.checked;
                this._saveSettings();
            });
        }

        const pollIntervalInput = document.getElementById('pollIntervalInput');
        if (pollIntervalInput) {
            pollIntervalInput.value = this.settings.pollInterval;
            pollIntervalInput.addEventListener('change', (e) => {
                this.settings.pollInterval = parseInt(e.target.value) || 1000;
                this._saveSettings();
                if (this.isMonitoring) {
                    this._stopPolling();
                    this._startPolling();
                }
            });
        }

        const openWebsiteBtn = document.getElementById('openWebsiteBtn');
        if (openWebsiteBtn) {
            openWebsiteBtn.addEventListener('click', () => {
                if (navigator.app && navigator.app.loadUrl) {
                    navigator.app.loadUrl('https://366.cyril.qzz.io', { openExternal: true });
                } else {
                    window.open('https://366.cyril.qzz.io', '_system');
                }
            });
        }

        this._initFloatingWindow();
    }

    _initSwipeGestures() {
        let startX = 0, startY = 0, startTime = 0;
        let tracking = false;
        let currentProgress = 0;
        const app = document.getElementById('app');
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        if (!app || !sideMenu || !menuOverlay) return;

        const EDGE_ZONE = 170;
        const MENU_WIDTH = 280;

        const clearInlineStyles = () => {
            sideMenu.style.transition = '';
            sideMenu.style.transform = '';
            menuOverlay.style.transition = '';
            menuOverlay.style.opacity = '';
            menuOverlay.style.visibility = '';
        };

        const applyProgress = (progress) => {
            progress = Math.max(0, Math.min(1, progress));
            sideMenu.style.transform = `translateX(${-MENU_WIDTH + progress * MENU_WIDTH}px)`;
            menuOverlay.style.opacity = progress;
            menuOverlay.style.visibility = progress > 0 ? 'visible' : 'hidden';
        };

        app.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            startTime = Date.now();
            tracking = false;
            currentProgress = sideMenu.classList.contains('open') ? 1 : 0;
        }, { passive: true });

        app.addEventListener('touchmove', (e) => {
            if (!startX) return;
            const touch = e.touches[0];
            const diffX = touch.clientX - startX;
            const diffY = touch.clientY - startY;
            const isOpen = sideMenu.classList.contains('open');

            if (!tracking) {
                if (Math.abs(diffX) < 8 || Math.abs(diffY) > Math.abs(diffX) * 1.2) return;
                if (!isOpen && startX > EDGE_ZONE) return;
                tracking = true;
                sideMenu.style.transition = 'none';
                menuOverlay.style.transition = 'none';
            }

            if (tracking) {
                currentProgress = isOpen
                    ? 1 + diffX / MENU_WIDTH
                    : diffX / MENU_WIDTH;
                applyProgress(currentProgress);
            }
        }, { passive: true });

        app.addEventListener('touchend', (e) => {
            if (!startX) return;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = endY - startY;
            const isOpen = sideMenu.classList.contains('open');
            const timeDiff = Date.now() - startTime;
            const velocity = timeDiff > 0 ? Math.abs(diffX) / timeDiff : 0;

            if (tracking) {
                const shouldOpen = currentProgress > 0.3 || (diffX > 30 && velocity > 0.3);
                const shouldClose = currentProgress < 0.7 || (diffX < -30 && velocity > 0.3);

                clearInlineStyles();

                if (isOpen) {
                    if (shouldClose) {
                        this.closeMenu();
                    }
                } else {
                    if (shouldOpen) {
                        this.openMenu();
                    }
                }
            } else {
                const isHorizontal = Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 20;
                if (isHorizontal && timeDiff < 400) {
                    if (startX < EDGE_ZONE && diffX > 20 && !isOpen) {
                        this.openMenu();
                    } else if (diffX < -20 && isOpen) {
                        this.closeMenu();
                    }
                }
            }

            startX = 0;
            startY = 0;
            startTime = 0;
            tracking = false;
            currentProgress = 0;
        }, { passive: true });

        app.addEventListener('touchcancel', () => {
            clearInlineStyles();
            startX = 0;
            startY = 0;
            tracking = false;
            currentProgress = 0;
        }, { passive: true });
    }

    _initFloatingWindow() {
        const floatHeader = document.getElementById('floatHeader');
        const floatExpandBtn = document.getElementById('floatExpandBtn');
        const floatingWindow = document.getElementById('floatingWindow');

        if (floatExpandBtn) {
            floatExpandBtn.addEventListener('click', () => this.hideFloatingWindow());
        }

        if (floatHeader) {
            let lastTap = 0;
            floatHeader.addEventListener('click', (e) => {
                if (e.target.closest('.float-expand-btn')) return;
                const now = Date.now();
                if (now - lastTap < 300) {
                    this.hideFloatingWindow();
                }
                lastTap = now;
            });
        }

        if (floatHeader && floatingWindow) {
            let isDragging = false;
            let offsetX = 0, offsetY = 0;

            floatHeader.addEventListener('touchstart', (e) => {
                if (e.target.closest('.float-expand-btn')) return;
                isDragging = true;
                const touch = e.touches[0];
                const rect = floatingWindow.getBoundingClientRect();
                offsetX = touch.clientX - rect.left;
                offsetY = touch.clientY - rect.top;
                floatingWindow.style.transition = 'none';
            }, { passive: true });

            floatHeader.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                const touch = e.touches[0];
                let x = touch.clientX - offsetX;
                let y = touch.clientY - offsetY;
                x = Math.max(0, Math.min(x, window.innerWidth - floatingWindow.offsetWidth));
                y = Math.max(0, Math.min(y, window.innerHeight - floatingWindow.offsetHeight));
                floatingWindow.style.left = x + 'px';
                floatingWindow.style.top = y + 'px';
                floatingWindow.style.right = 'auto';
                floatingWindow.style.bottom = 'auto';
            }, { passive: true });

            floatHeader.addEventListener('touchend', () => {
                isDragging = false;
                floatingWindow.style.transition = '';
            }, { passive: true });
        }
    }

    toggleMenu() {
        const sideMenu = document.getElementById('sideMenu');
        if (sideMenu && sideMenu.classList.contains('open')) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        if (sideMenu) {
            sideMenu.style.transform = '';
            sideMenu.style.transition = '';
            sideMenu.classList.add('open');
        }
        if (menuOverlay) {
            menuOverlay.style.opacity = '';
            menuOverlay.style.visibility = '';
            menuOverlay.style.transition = '';
            menuOverlay.classList.add('show');
        }
        if (navigator.vibrate) navigator.vibrate(10);
    }

    closeMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        if (sideMenu) {
            sideMenu.style.transform = '';
            sideMenu.style.transition = '';
            sideMenu.classList.remove('open');
        }
        if (menuOverlay) {
            menuOverlay.style.opacity = '';
            menuOverlay.style.visibility = '';
            menuOverlay.style.transition = '';
            menuOverlay.classList.remove('show');
        }
    }

    showView(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) targetView.classList.add('active');
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-view') === viewName);
        });
    }

    async toggleMonitoring() {
        if (this.isMonitoring) {
            this.stopMonitoring();
        } else {
            await this.startMonitoring();
        }
    }

    async startMonitoring() {
        this.addLog('正在初始化 flipbook 目录...', 'info');
        this._updateMonitorBtn('loading');

        const initResult = await this._initFlipbookDir();
        if (!initResult) {
            this.addLog('flipbook 目录初始化失败', 'error');
            this.showToast('目录初始化失败', 'error');
            this._updateMonitorBtn('start');
            return;
        }

        this.addLog('初始化完毕，开始监听...', 'success');
        this._updateStatus('monitorStatus', '监听中', 'running');
        this.isMonitoring = true;
        this._updateMonitorBtn('stop');
        document.getElementById('minimizeBtn').style.display = '';

        this._startPolling();
        this.showToast('监听已启动', 'success');
    }

    stopMonitoring() {
        this.isMonitoring = false;
        this._stopPolling();
        this._updateStatus('monitorStatus', '已停止', 'stopped');
        this._updateMonitorBtn('start');
        document.getElementById('minimizeBtn').style.display = 'none';
        this.addLog('监听已停止', 'warning');
    }

    async _requestStoragePermission() {
        if (!window.FlipbookScanner) {
            this.addLog('原生文件 API 不可用', 'warning');
            return true;
        }

        var app = this;
        return new Promise(function(resolve) {
            FlipbookScanner.checkPermission(function(result) {
                if (result && result.hasPermission) {
                    app.addLog('所有文件访问权限已获取', 'success');
                    resolve(true);
                } else {
                    app.addLog('未获取"所有文件访问"权限，请在系统设置中开启', 'error');
                    resolve(false);
                }
            }, function() {
                app.addLog('权限检查失败', 'error');
                resolve(false);
            });
        });
    }

    async _initFlipbookDir() {
        var path = this.settings.flipbookPath;
        return new Promise((resolve) => {
            if (!window.FlipbookScanner) {
                this.addLog('原生文件 API 不可用', 'error');
                resolve(false);
                return;
            }
            this.flipbookDirPath = path;
            this._ensureDirExistsNative(path).then(() => {
                return this._clearDirContentsNative(path);
            }).then(() => {
                this.addLog('flipbook 目录已清空', 'success');
                resolve(true);
            }).catch(() => {
                this.addLog('清空目录失败，继续监听', 'warning');
                resolve(true);
            });
        });
    }

    async _ensureDirExistsNative(path) {
        return new Promise((resolve) => {
            FlipbookScanner.ensureDirectory(path, () => {
                this.addLog('已创建 flipbook 目录', 'info');
                resolve(true);
            }, () => {
                resolve(true);
            });
        });
    }

    async _clearDirContentsNative(path) {
        return new Promise((resolve, reject) => {
            FlipbookScanner.clearDirectory(path, () => {
                this.knownFiles.clear();
                resolve(true);
            }, () => {
                this.knownFiles.clear();
                reject(false);
            });
        });
    }

    _startPolling() {
        this._stopPolling();
        this.pollTimer = setInterval(() => this._pollFlipbook(), this.settings.pollInterval);
    }

    _stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    async _pollFlipbook() {
        if (!this.flipbookDirPath || !this.isMonitoring) return;
        try {
            const entries = await this._listFlipbookFiles(this.flipbookDirPath);
            if (!entries) return;
            for (const entry of entries) {
                const name = entry.name;
                if (!this.knownFiles.has(name)) {
                    this.knownFiles.add(name);
                    this.addLog('检测到新文件: ' + name, 'important');
                    this._processNewEntryNative(entry, name);
                }
            }
        } catch (error) {
            console.error('Poll error:', error);
        }
    }

    _listFlipbookFiles(path) {
        var app = this;
        return new Promise((resolve) => {
            FlipbookScanner.listFiles(path, (entries) => {
                resolve(entries);
            }, (error) => {
                app.addLog('读取目录失败: ' + error, 'error');
                app.showNotification('error');
                resolve(null);
            });
        });
    }

    _readFileNative(path) {
        var app = this;
        return new Promise((resolve) => {
            FlipbookScanner.readFile(path, (result) => {
                resolve(result);
            }, (error) => {
                app.addLog('读取文件失败: ' + error, 'error');
                resolve(null);
            });
        });
    }

    async _processNewEntryNative(entry, name) {
        try {
            var answers = [];
            var fullPath = entry.path;
            var isDirectory = entry.isDirectory;
            var isFile = entry.isFile;

            if (isDirectory) {
                this.addLog('扫描目录: ' + name, 'info');
                if (window.nodejs && window.nodejs.channel) {
                    answers = await this._processWithNodeJS('process-directory', fullPath);
                }
                if (answers.length === 0) {
                    answers = await this.extractor.scanDirectoryForAnswersNative(fullPath, (msg, type) => this.addLog(msg, type), FlipbookScanner);
                }
            } else if (isFile) {
                var lowerName = name.toLowerCase();
                if (lowerName.endsWith('.zip')) {
                    if (window.nodejs && window.nodejs.channel) {
                        answers = await this._processWithNodeJS('process-zip', fullPath);
                    } else {
                        this.addLog('ZIP文件需要Node.js后端支持: ' + name, 'warning');
                    }
                    if (answers.length === 0) return;
                } else {
                    var isRelevant = lowerName.endsWith('.json') || lowerName.endsWith('.js') ||
                        lowerName.endsWith('.xml') || lowerName.endsWith('.txt') || lowerName.endsWith('.u3enc');
                    if (isRelevant) {
                        var fileData = await this._readFileNative(fullPath);
                        if (fileData && fileData.content) {
                            answers = await this.extractor.processFileContent(fileData.content, lowerName);
                        }
                    } else {
                        this.addLog('跳过不相关文件: ' + name, 'info');
                        return;
                    }
                }
            }

            if (answers.length > 0) {
                this.addLog('从 ' + name + ' 提取到 ' + answers.length + ' 个答案', 'success');
                this.answers.push(...answers.map(a => ({
                    ...a,
                    source: name,
                    timestamp: Date.now()
                })));
                this._updateStatus('answerCount', String(this.answers.length), 'running');
                this._renderAnswers();
                this._updateFloatingWindow();
                this.showNotification('answer');
            } else {
                this.addLog(name + ' 中未找到答案', 'warning');
            }
        } catch (error) {
            this.addLog('处理 ' + name + ' 失败: ' + error.message, 'error');
        }
    }

    _processWithNodeJS(action, filePath) {
        return new Promise((resolve) => {
            if (!window.nodejs || !window.nodejs.channel) {
                resolve([]);
                return;
            }
            const timeout = setTimeout(() => {
                resolve([]);
            }, 30000);
            const handler = (data) => {
                if (data.source === filePath || data.source === action) {
                    clearTimeout(timeout);
                    window.nodejs.channel.removeListener('process-result', handler);
                    if (data.success && data.answers) {
                        resolve(data.answers);
                    } else {
                        resolve([]);
                    }
                }
            };
            window.nodejs.channel.on('process-result', handler);
            window.nodejs.channel.post(action, filePath);
        });
    }

    showFloatingWindow() {
        this.isFloating = true;
        document.getElementById('floatingWindow').style.display = '';
        document.querySelector('.main-content').style.display = 'none';
        this._updateFloatingWindow();
    }

    hideFloatingWindow() {
        this.isFloating = false;
        document.getElementById('floatingWindow').style.display = 'none';
        document.querySelector('.main-content').style.display = '';
        this.showView('answers');
    }

    _updateFloatingWindow() {
        const floatEmpty = document.getElementById('floatEmpty');
        const floatAnswers = document.getElementById('floatAnswers');
        if (this.answers.length === 0) {
            if (floatEmpty) floatEmpty.style.display = '';
            if (floatAnswers) floatAnswers.style.display = 'none';
            return;
        }
        if (floatEmpty) floatEmpty.style.display = 'none';
        if (floatAnswers) floatAnswers.style.display = '';

        const recentAnswers = this.answers.slice(-20).reverse();
        floatAnswers.innerHTML = recentAnswers.map((ans, i) => `
            <div class="float-answer-item" data-index="${this.answers.length - 1 - i}">
                <div class="float-answer-q">${this._escapeHtml(ans.question || '')}</div>
                <div class="float-answer-a">${this._escapeHtml(ans.answer || '')}</div>
            </div>
        `).join('');

        floatAnswers.querySelectorAll('.float-answer-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.getAttribute('data-index'));
                const ans = this.answers[idx];
                if (ans) this._copyToClipboard(ans.answer);
            });
        });
    }

    _renderAnswers() {
        const container = document.getElementById('answersContainer');
        if (!container) return;

        if (this.answers.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="bi bi-inbox"></i>
                    <p>暂无答案数据</p>
                    <small>开始监听后练习即可自动获取答案</small>
                </div>`;
            return;
        }

        let html = '<div class="answer-group">';
        html += `<div class="group-header"><h4><i class="bi bi-list-check"></i> 答案列表</h4><span class="answer-count-badge">${this.answers.length}</span></div>`;
        this.answers.forEach((ans, i) => {
            html += `
                <div class="answer-item" data-index="${i}">
                    <div class="answer-header">
                        <span class="answer-index">${this._escapeHtml(ans.question || '未知问题')}</span>
                        <span class="answer-type">${this._escapeHtml(ans.pattern || '未知')}</span>
                    </div>
                    <div class="answer-text">${this._escapeHtml(ans.answer || '')}</div>
                </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.answer-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.getAttribute('data-index'));
                const ans = this.answers[idx];
                if (ans) this._copyToClipboard(ans.answer);
            });
        });
    }

    _copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('已复制到剪贴板', 'success');
            }).catch(() => {
                this._fallbackCopy(text);
            });
        } else {
            this._fallbackCopy(text);
        }
    }

    _fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this.showToast('已复制到剪贴板', 'success');
        } catch (e) {
            this.showToast('复制失败', 'error');
        }
        document.body.removeChild(textarea);
    }

    addLog(message, type = 'normal') {
        const timestamp = new Date().toLocaleTimeString();
        this.logs.unshift({ message, type, timestamp });
        if (this.logs.length > 500) this.logs = this.logs.slice(0, 500);
        if (type !== 'normal') this.logCount++;
        this._renderLogs();
        this._updateLogCount();
    }

    _renderLogs() {
        const container = document.getElementById('logsContainer');
        if (!container) return;
        if (this.logs.length === 0) {
            container.innerHTML = '<div class="log-item normal"><i class="bi bi-hourglass-split"></i><span>等待操作...</span></div>';
            return;
        }
        container.innerHTML = this.logs.map(log => {
            const iconClass = {
                success: 'bi-check-circle', error: 'bi-x-circle',
                warning: 'bi-exclamation-triangle', important: 'bi-info-circle',
                info: 'bi-info-circle', normal: 'bi-dot'
            }[log.type] || 'bi-dot';
            return `<div class="log-item ${log.type}"><i class="bi ${iconClass}"></i><span>[${log.timestamp}] ${this._escapeHtml(log.message)}</span></div>`;
        }).join('');
    }

    _updateLogCount() {
        const el = document.getElementById('logCount');
        if (el) el.textContent = this.logCount;
    }

    clearAnswers() {
        this.answers = [];
        this._updateStatus('answerCount', '0', 'stopped');
        this._renderAnswers();
        this._updateFloatingWindow();
        this.showToast('答案已清空', 'success');
    }

    clearLogs() {
        this.logs = [];
        this.logCount = 0;
        this._renderLogs();
        this._updateLogCount();
        this.showToast('日志已清空', 'success');
    }

    copyAllLogs() {
        if (this.logs.length === 0) {
            this.showToast('暂无日志可复制', 'warning');
            return;
        }
        const allText = this.logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
        this._copyToClipboard(allText);
    }

    _updateStatus(elementId, text, className) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = text;
            el.className = `status-value ${className}`;
        }
    }

    _updateMonitorBtn(state) {
        const btn = document.getElementById('toggleMonitorBtn');
        if (!btn) return;
        switch (state) {
            case 'start':
                btn.innerHTML = '<i class="bi bi-play-circle"></i><span>开始监听</span>';
                btn.className = 'primary-btn full-width';
                btn.disabled = false;
                break;
            case 'stop':
                btn.innerHTML = '<i class="bi bi-stop-circle"></i><span>停止监听</span>';
                btn.className = 'primary-btn full-width danger';
                btn.disabled = false;
                break;
            case 'loading':
                btn.innerHTML = '<i class="bi bi-hourglass-split"></i><span>初始化中...</span>';
                btn.disabled = true;
                break;
        }
    }

    _updateUI() {
        this._renderAnswers();
        this._renderLogs();
        this._updateLogCount();
    }

    _loadSettings() {
        try {
            const saved = localStorage.getItem('auto366-settings');
            if (saved) this.settings = { ...this.settings, ...JSON.parse(saved) };
        } catch (e) {}
        const autoStart = document.getElementById('autoStartMonitor');
        if (autoStart) autoStart.checked = this.settings.autoStart;
        const pollInput = document.getElementById('pollIntervalInput');
        if (pollInput) pollInput.value = this.settings.pollInterval;
    }

    _saveSettings() {
        try {
            localStorage.setItem('auto366-settings', JSON.stringify(this.settings));
        } catch (e) {}
    }

    _updateAboutLogo() {
        const logo = document.getElementById('aboutLogo');
        if (!logo) return;
        const isDark = document.documentElement.classList.contains('dark-mode');
        logo.src = isDark ? 'img/icon.png' : 'img/icon_black.png';
    }

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoadingToast(message) {
        const toast = document.getElementById('loadingToast');
        if (!toast) return;
        const msg = toast.querySelector('.toast-message');
        if (msg) msg.textContent = message;
        toast.classList.add('show');
    }

    hideLoadingToast() {
        const toast = document.getElementById('loadingToast');
        if (toast) toast.classList.remove('show');
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('messageToast');
        if (!toast) return;
        const icon = toast.querySelector('.toast-icon');
        const msg = toast.querySelector('.toast-message');
        if (icon && msg) {
            const iconClass = {
                success: 'bi-check-circle', error: 'bi-x-circle',
                warning: 'bi-exclamation-triangle', info: 'bi-info-circle'
            }[type] || 'bi-info-circle';
            icon.className = `toast-icon bi ${iconClass}`;
            msg.textContent = message;
            toast.className = `toast ${type}`;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }
    }

    showNotification(type) {
        const bar = document.getElementById('notificationBar');
        const item = document.getElementById(type === 'error' ? 'errorMsg' : 'answerMsg');
        if (bar) bar.style.display = '';
        if (item) item.style.display = '';
    }

    hideNotification(type) {
        const bar = document.getElementById('notificationBar');
        const item = document.getElementById(type === 'error' ? 'errorMsg' : 'answerMsg');
        if (item) item.style.display = 'none';
        if (bar && bar.querySelectorAll('.notification-item[style*="display: none"]').length === bar.querySelectorAll('.notification-item').length) {
            bar.style.display = 'none';
        }
    }
}

window.Auto366App = Auto366App;
