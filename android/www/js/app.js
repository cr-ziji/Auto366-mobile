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
        this._initDarkMode();
        this._initEventListeners();
        this._loadSettings();
        this._updateUI();
        if (this.settings.autoStart) {
            setTimeout(() => this.startMonitoring(), 500);
        }
    }

    _initDarkMode() {
        const saved = this.settings.darkMode;
        if (saved === true) {
            document.documentElement.classList.add('dark-mode');
        } else if (saved === false) {
            document.documentElement.classList.remove('dark-mode');
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) document.documentElement.classList.add('dark-mode');
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) toggle.checked = prefersDark;
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.settings.darkMode === null) {
                if (e.matches) {
                    document.documentElement.classList.add('dark-mode');
                } else {
                    document.documentElement.classList.remove('dark-mode');
                }
                const toggle = document.getElementById('darkModeToggle');
                if (toggle) toggle.checked = e.matches;
            }
        });
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

        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('change', (e) => {
                this.settings.darkMode = e.target.checked;
                if (e.target.checked) {
                    document.documentElement.classList.add('dark-mode');
                } else {
                    document.documentElement.classList.remove('dark-mode');
                }
                this._saveSettings();
            });
        }

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
        this.addLog('正在请求存储权限...', 'info');
        this._updateMonitorBtn('loading');

        const hasPermission = await this._requestStoragePermission();
        if (!hasPermission) {
            this.addLog('存储权限被拒绝', 'error');
            this.showToast('需要存储权限才能工作', 'error');
            this._updateMonitorBtn('start');
            return;
        }

        this._updateStatus('permissionStatus', '已授权', 'running');
        this.addLog('存储权限已获取', 'success');

        this.addLog('正在初始化 flipbook 目录...', 'info');
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
        if (!window.cordova) {
            this.addLog('非 Cordova 环境，跳过权限检查', 'warning');
            return true;
        }
        return new Promise((resolve) => {
            if (!window.permissions || !cordova.plugins || !cordova.plugins.permissions) {
                this.addLog('权限插件不可用，尝试直接访问', 'warning');
                resolve(true);
                return;
            }
            const perms = cordova.plugins.permissions;
            const sdkVersion = device ? (parseInt(device.version) || 0) : 0;

            if (sdkVersion >= 30) {
                perms.checkPermission(perms.MANAGE_EXTERNAL_STORAGE, (status) => {
                    if (status.hasPermission) {
                        resolve(true);
                    } else {
                        perms.requestPermission(perms.MANAGE_EXTERNAL_STORAGE, (result) => {
                            if (result.hasPermission) {
                                resolve(true);
                            } else {
                                perms.requestPermission(perms.READ_EXTERNAL_STORAGE, (r2) => {
                                    resolve(r2.hasPermission);
                                }, () => resolve(false));
                            }
                        }, () => resolve(false));
                    }
                }, () => resolve(false));
            } else {
                perms.checkPermission(perms.READ_EXTERNAL_STORAGE, (status) => {
                    if (status.hasPermission) {
                        resolve(true);
                    } else {
                        perms.requestPermissions(
                            [perms.READ_EXTERNAL_STORAGE, perms.WRITE_EXTERNAL_STORAGE],
                            (result) => {
                                resolve(result.hasPermission);
                            },
                            () => resolve(false)
                        );
                    }
                }, () => {
                    perms.requestPermissions(
                        [perms.READ_EXTERNAL_STORAGE, perms.WRITE_EXTERNAL_STORAGE],
                        (result) => resolve(result.hasPermission),
                        () => resolve(false)
                    );
                });
            }
        });
    }

    async _initFlipbookDir() {
        const path = this.settings.flipbookPath;
        return new Promise((resolve) => {
            if (!window.resolveLocalFileSystemURL) {
                this.addLog('文件系统 API 不可用', 'error');
                resolve(false);
                return;
            }
            window.resolveLocalFileSystemURL(path, (dirEntry) => {
                this.flipbookDirEntry = dirEntry;
                this._clearDirContents(dirEntry).then(() => {
                    this.addLog('flipbook 目录已清空', 'success');
                    resolve(true);
                }).catch(() => {
                    this.addLog('清空目录失败，继续监听', 'warning');
                    resolve(true);
                });
            }, (error) => {
                if (error.code === 1) {
                    this.addLog('flipbook 目录不存在，尝试创建...', 'warning');
                    const parentPath = path.substring(0, path.lastIndexOf('/'));
                    const dirName = path.substring(path.lastIndexOf('/') + 1);
                    window.resolveLocalFileSystemURL(parentPath, (parentEntry) => {
                        parentEntry.getDirectory(dirName, { create: true }, (dirEntry) => {
                            this.flipbookDirEntry = dirEntry;
                            this.addLog('flipbook 目录已创建', 'success');
                            resolve(true);
                        }, () => {
                            this.addLog('创建 flipbook 目录失败', 'error');
                            resolve(false);
                        });
                    }, () => {
                        this.addLog('无法访问父目录', 'error');
                        resolve(false);
                    });
                } else {
                    this.addLog(`访问 flipbook 目录失败: ${error.code}`, 'error');
                    resolve(false);
                }
            });
        });
    }

    async _clearDirContents(dirEntry) {
        const reader = dirEntry.createReader();
        const entries = await new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
        });
        for (const entry of entries) {
            await new Promise((resolve) => {
                if (entry.isDirectory) {
                    entry.removeRecursively(resolve, resolve);
                } else {
                    entry.remove(resolve, resolve);
                }
            });
        }
        this.knownFiles.clear();
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
        if (!this.flipbookDirEntry || !this.isMonitoring) return;
        try {
            const reader = this.flipbookDirEntry.createReader();
            const entries = await new Promise((resolve, reject) => {
                reader.readEntries(resolve, reject);
            });
            for (const entry of entries) {
                const name = entry.name;
                if (!this.knownFiles.has(name)) {
                    this.knownFiles.add(name);
                    this.addLog(`检测到新文件: ${name}`, 'important');
                    this._processNewEntry(entry, name);
                }
            }
        } catch (error) {
            console.error('Poll error:', error);
        }
    }

    async _processNewEntry(entry, name) {
        try {
            let answers = [];
            if (entry.isDirectory) {
                this.addLog(`扫描目录: ${name}`, 'info');
                if (window.nodejs && window.nodejs.channel) {
                    const nativePath = entry.nativeURL ? decodeURIComponent(entry.nativeURL.replace('file://', '')) : '';
                    if (nativePath) {
                        answers = await this._processWithNodeJS('process-directory', nativePath);
                    }
                }
                if (answers.length === 0) {
                    answers = await this.extractor.scanDirectoryForAnswers(entry, (msg, type) => this.addLog(msg, type));
                }
            } else if (entry.isFile) {
                const lowerName = name.toLowerCase();
                if (lowerName.endsWith('.zip')) {
                    if (window.nodejs && window.nodejs.channel) {
                        const nativePath = entry.nativeURL ? decodeURIComponent(entry.nativeURL.replace('file://', '')) : '';
                        if (nativePath) {
                            answers = await this._processWithNodeJS('process-zip', nativePath);
                        }
                    } else {
                        this.addLog(`ZIP文件需要Node.js后端支持: ${name}`, 'warning');
                    }
                    if (answers.length === 0) return;
                } else {
                    const isRelevant = lowerName.endsWith('.json') || lowerName.endsWith('.js') ||
                        lowerName.endsWith('.xml') || lowerName.endsWith('.txt') || lowerName.endsWith('.u3enc');
                    if (isRelevant) {
                        answers = await this.extractor.processFile(entry);
                    } else {
                        this.addLog(`跳过不相关文件: ${name}`, 'info');
                        return;
                    }
                }
            }

            if (answers.length > 0) {
                this.addLog(`从 ${name} 提取到 ${answers.length} 个答案`, 'success');
                this.answers.push(...answers.map(a => ({
                    ...a,
                    source: name,
                    timestamp: Date.now()
                })));
                this._updateStatus('answerCount', String(this.answers.length), 'running');
                this._renderAnswers();
                this._updateFloatingWindow();
            } else {
                this.addLog(`${name} 中未找到答案`, 'warning');
            }
        } catch (error) {
            this.addLog(`处理 ${name} 失败: ${error.message}`, 'error');
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
        const toggle = document.getElementById('darkModeToggle');
        if (toggle && this.settings.darkMode !== null) toggle.checked = this.settings.darkMode;
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
}

window.Auto366App = Auto366App;
