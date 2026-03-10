/**
 * Auto366 Mobile App
 * 天学网自动化答题工具移动版
 */

class Auto366Mobile {
    constructor() {
        this.currentView = 'proxy';
        this.isProxyRunning = false;
        this.answers = [];
        this.logs = [];
        this.requestCount = 0;
        this.settings = {
            proxyPort: 5291,
            bucketPort: 5290,
            autoStartProxy: true,
            keepCacheFiles: false,
            answerCaptureEnabled: true
        };
        
        // 绑定方法到实例
        this.init = this.init.bind(this);
        this.initEventListeners = this.initEventListeners.bind(this);
        this.showView = this.showView.bind(this);
        this.toggleMenu = this.toggleMenu.bind(this);
        this.closeMenu = this.closeMenu.bind(this);
        
        console.log('Auto366Mobile initialized');
    }

    init() {
        console.log('Initializing Auto366Mobile...');
        
        // 初始化事件监听器
        this.initEventListeners();
        
        // 加载设置
        this.loadSettings();
        
        // 初始化UI状态
        this.updateUI();
        
        // 如果设置了自动启动代理，则启动
        if (this.settings.autoStartProxy) {
            setTimeout(() => {
                this.startProxy();
            }, 1000);
        }
        
        console.log('Auto366Mobile initialization complete');
    }

    initEventListeners() {
        console.log('Initializing event listeners...');
        
        // 菜单控制
        const menuToggle = document.getElementById('menuToggle');
        const menuClose = document.getElementById('menuClose');
        const menuOverlay = document.getElementById('menuOverlay');
        
        if (menuToggle) {
            menuToggle.addEventListener('click', this.toggleMenu);
        }
        
        if (menuClose) {
            menuClose.addEventListener('click', this.closeMenu);
        }
        
        if (menuOverlay) {
            menuOverlay.addEventListener('click', this.closeMenu);
        }

        // 添加滑动手势支持
        this.initSwipeGestures();

        // 菜单项点击
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                this.showView(view);
                this.closeMenu();
            });
        });

        // 代理控制按钮
        const toggleProxyBtn = document.getElementById('toggleProxyBtn');
        if (toggleProxyBtn) {
            toggleProxyBtn.addEventListener('click', () => {
                this.toggleProxy();
            });
        }

        // 清理缓存按钮
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearCache();
            });
        }

        // 设置按钮
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showView('settings');
                this.closeMenu();
            });
        }

        // 答案获取开关
        const answerCaptureEnabled = document.getElementById('answerCaptureEnabled');
        if (answerCaptureEnabled) {
            answerCaptureEnabled.addEventListener('change', (e) => {
                this.settings.answerCaptureEnabled = e.target.checked;
                this.saveSettings();
                this.showToast(
                    e.target.checked ? '答案获取已启用' : '答案获取已禁用',
                    'success'
                );
            });
        }

        // 清空答案按钮
        const clearAnswersBtn = document.getElementById('clearAnswersBtn');
        if (clearAnswersBtn) {
            clearAnswersBtn.addEventListener('click', () => {
                this.clearAnswers();
            });
        }

        // 分享答案按钮
        const shareAnswerBtn = document.getElementById('shareAnswerBtn');
        if (shareAnswerBtn) {
            shareAnswerBtn.addEventListener('click', () => {
                this.shareAnswers();
            });
        }

        // 导出答案按钮
        const exportAnswerBtn = document.getElementById('exportAnswerBtn');
        if (exportAnswerBtn) {
            exportAnswerBtn.addEventListener('click', () => {
                this.exportAnswers();
            });
        }

        // 导入答案
        const importAnswer = document.getElementById('importAnswer');
        if (importAnswer) {
            importAnswer.addEventListener('change', (e) => {
                this.importAnswers(e.target.files[0]);
            });
        }

        // 排序模式选择
        const sortMode = document.getElementById('sortMode');
        if (sortMode) {
            sortMode.addEventListener('change', (e) => {
                this.displayAnswers(this.answers, e.target.value);
            });
        }

        // 清空日志按钮
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }

        // 刷新规则集按钮
        const refreshRulesetsBtn = document.getElementById('refreshRulesetsBtn');
        if (refreshRulesetsBtn) {
            refreshRulesetsBtn.addEventListener('click', () => {
                this.loadCommunityRulesets();
            });
        }

        // 搜索规则集按钮
        const searchRulesetsBtn = document.getElementById('searchRulesetsBtn');
        if (searchRulesetsBtn) {
            searchRulesetsBtn.addEventListener('click', () => {
                this.searchRulesets();
            });
        }

        // 端口修改按钮
        const changePortBtn = document.getElementById('changePortBtn');
        if (changePortBtn) {
            changePortBtn.addEventListener('click', () => {
                this.showView('settings');
                this.closeMenu();
            });
        }

        // 清理天学网缓存按钮
        const deleteFileTempBtn = document.getElementById('deleteFileTempBtn');
        if (deleteFileTempBtn) {
            deleteFileTempBtn.addEventListener('click', () => {
                this.clearFileTemp();
            });
        }

        // 上传规则集按钮
        const uploadRulesetBtn = document.getElementById('uploadRulesetBtn');
        if (uploadRulesetBtn) {
            uploadRulesetBtn.addEventListener('click', () => {
                this.uploadRuleset();
            });
        }

        // 添加规则集按钮
        const addRuleGroupBtn = document.getElementById('addRuleGroupBtn');
        if (addRuleGroupBtn) {
            addRuleGroupBtn.addEventListener('click', () => {
                this.addRuleGroup();
            });
        }

        // 搜索过滤器
        const sortBySelect = document.getElementById('sortBySelect');
        const sortOrderSelect = document.getElementById('sortOrderSelect');
        if (sortBySelect && sortOrderSelect) {
            sortBySelect.addEventListener('change', () => {
                this.loadCommunityRulesets();
            });
            sortOrderSelect.addEventListener('change', () => {
                this.loadCommunityRulesets();
            });
        }

        // 分页控制
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        if (prevPageBtn && nextPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                this.previousPage();
            });
            nextPageBtn.addEventListener('click', () => {
                this.nextPage();
            });
        }

        // 缓存路径浏览
        const browseCacheBtn = document.getElementById('browseCacheBtn');
        if (browseCacheBtn) {
            browseCacheBtn.addEventListener('click', () => {
                this.browseCachePath();
            });
        }

        // 更新通知按钮
        const updateNotificationBtn = document.getElementById('update-notification-btn');
        if (updateNotificationBtn) {
            updateNotificationBtn.addEventListener('click', () => {
                this.checkForUpdates();
            });
        }
        
        console.log('Event listeners initialized');
    }

    initSwipeGestures() {
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        
        const app = document.getElementById('app');
        if (!app) return;
        
        app.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });
        
        app.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const endTime = Date.now();
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            const timeDiff = endTime - startTime;
            
            // 检查是否为快速滑动（时间小于300ms）且主要是水平方向
            if (timeDiff < 300 && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
                const isMenuOpen = document.getElementById('sideMenu').classList.contains('open');
                
                // 从左边缘向右滑动打开菜单
                if (startX < 50 && diffX > 80 && !isMenuOpen) {
                    e.preventDefault();
                    this.toggleMenu();
                }
                // 向左滑动关闭菜单
                else if (diffX < -80 && isMenuOpen) {
                    e.preventDefault();
                    this.closeMenu();
                }
            }
            
            // 重置
            startX = 0;
            startY = 0;
            startTime = 0;
        }, { passive: false });
    }

    initSettingsListeners() {
        // 代理端口设置
        const proxyPortInput = document.getElementById('proxyPortInput');
        if (proxyPortInput) {
            proxyPortInput.addEventListener('change', (e) => {
                const port = parseInt(e.target.value);
                if (port >= 1024 && port <= 65535) {
                    this.settings.proxyPort = port;
                    this.saveSettings();
                    this.showToast(`代理端口已设置为 ${port}`, 'success');
                } else {
                    e.target.value = this.settings.proxyPort;
                    this.showToast('端口号必须在1024-65535之间', 'error');
                }
            });
        }

        // 答案服务器端口设置
        const bucketPortInput = document.getElementById('bucketPortInput');
        if (bucketPortInput) {
            bucketPortInput.addEventListener('change', (e) => {
                const port = parseInt(e.target.value);
                if (port >= 1024 && port <= 65535) {
                    this.settings.bucketPort = port;
                    this.saveSettings();
                    this.showToast(`答案服务器端口已设置为 ${port}`, 'success');
                } else {
                    e.target.value = this.settings.bucketPort;
                    this.showToast('端口号必须在1024-65535之间', 'error');
                }
            });
        }

        // 自动启动代理设置
        const autoStartProxy = document.getElementById('autoStartProxy');
        if (autoStartProxy) {
            autoStartProxy.addEventListener('change', (e) => {
                this.settings.autoStartProxy = e.target.checked;
                this.saveSettings();
                this.showToast(
                    e.target.checked ? '已启用启动时自动开启代理' : '已禁用启动时自动开启代理',
                    'success'
                );
            });
        }

        // 保留缓存文件设置
        const keepCacheFiles = document.getElementById('keepCacheFiles');
        if (keepCacheFiles) {
            keepCacheFiles.addEventListener('change', (e) => {
                this.settings.keepCacheFiles = e.target.checked;
                this.saveSettings();
                this.showToast(
                    e.target.checked ? '已启用保留缓存文件' : '已禁用保留缓存文件',
                    'success'
                );
            });
        }
    }

    toggleMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        
        if (sideMenu && menuOverlay) {
            sideMenu.classList.toggle('open');
            menuOverlay.classList.toggle('show');
        }
    }

    closeMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        
        if (sideMenu && menuOverlay) {
            sideMenu.classList.remove('open');
            menuOverlay.classList.remove('show');
        }
    }

    showView(viewName) {
        // 更新当前视图
        this.currentView = viewName;
        
        // 隐藏所有视图
        const viewContainers = document.querySelectorAll('.view-container');
        viewContainers.forEach(container => {
            container.classList.remove('active');
        });
        
        // 显示目标视图
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
        }
        
        // 更新菜单项状态
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            }
        });
        
        // 根据视图执行特定操作
        switch (viewName) {
            case 'answers':
                this.displayAnswers(this.answers);
                break;
            case 'rules':
                this.loadRules();
                break;
            case 'community':
                this.loadCommunityRulesets();
                break;
            case 'logs':
                this.displayLogs();
                break;
            case 'settings':
                this.updateSettingsUI();
                break;
        }
    }

    toggleProxy() {
        if (this.isProxyRunning) {
            this.stopProxy();
        } else {
            this.startProxy();
        }
    }

    startProxy() {
        const toggleBtn = document.getElementById('toggleProxyBtn');
        
        if (toggleBtn) {
            toggleBtn.disabled = true;
            toggleBtn.innerHTML = '<i class="bi bi-hourglass-split"></i><span>启动中...</span>';
        }
        
        this.showLoadingToast('正在启动代理服务器...');
        
        // 模拟代理启动过程
        setTimeout(() => {
            this.isProxyRunning = true;
            this.updateProxyStatus('running', `已开启在 127.0.0.1:${this.settings.proxyPort}`);
            
            if (toggleBtn) {
                toggleBtn.disabled = false;
                this.updateToggleButton();
            }
            
            this.hideLoadingToast();
            this.showToast('代理服务器已启动', 'success');
            this.addLog('代理服务器已启动', 'success');
        }, 2000);
    }

    stopProxy() {
        const toggleBtn = document.getElementById('toggleProxyBtn');
        
        if (toggleBtn) {
            toggleBtn.disabled = true;
            toggleBtn.innerHTML = '<i class="bi bi-hourglass-split"></i><span>停止中...</span>';
        }
        
        this.showLoadingToast('正在停止代理服务器...');
        
        // 模拟代理停止过程
        setTimeout(() => {
            this.isProxyRunning = false;
            this.updateProxyStatus('stopped', '已停止');
            
            if (toggleBtn) {
                toggleBtn.disabled = false;
                this.updateToggleButton();
            }
            
            this.hideLoadingToast();
            this.showToast('代理服务器已停止', 'success');
            this.addLog('代理服务器已停止', 'success');
        }, 1500);
    }

    updateProxyStatus(status, message) {
        const proxyStatus = document.getElementById('proxyStatus');
        if (proxyStatus) {
            proxyStatus.textContent = message;
            proxyStatus.className = `status-value ${status}`;
        }
    }

    clearCache() {
        this.showLoadingToast('正在清理缓存...');
        
        // 模拟清理过程
        setTimeout(() => {
            this.hideLoadingToast();
            this.showToast('缓存清理完成', 'success');
            this.addLog('缓存清理完成', 'success');
        }, 1000);
    }

    clearAnswers() {
        if (this.answers.length === 0) {
            this.showToast('暂无答案数据', 'warning');
            return;
        }
        
        if (confirm('确定要清空所有答案数据吗？')) {
            this.answers = [];
            this.displayAnswers([]);
            this.showToast('答案数据已清空', 'success');
            this.addLog('答案数据已清空', 'success');
        }
    }

    shareAnswers() {
        if (this.answers.length === 0) {
            this.showToast('暂无答案数据可分享', 'warning');
            return;
        }
        
        this.showLoadingToast('正在分享答案...');
        
        // 模拟分享过程
        setTimeout(() => {
            this.hideLoadingToast();
            this.showToast('答案分享成功', 'success');
            this.addLog('答案分享成功', 'success');
        }, 2000);
    }

    exportAnswers() {
        if (this.answers.length === 0) {
            this.showToast('暂无答案数据可导出', 'warning');
            return;
        }
        
        try {
            const dataStr = JSON.stringify(this.answers, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `auto366-answers-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            this.showToast('答案导出成功', 'success');
            this.addLog('答案导出成功', 'success');
        } catch (error) {
            this.showToast('答案导出失败', 'error');
            this.addLog(`答案导出失败: ${error.message}`, 'error');
        }
    }

    importAnswers(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedAnswers = JSON.parse(e.target.result);
                if (Array.isArray(importedAnswers)) {
                    this.answers = [...this.answers, ...importedAnswers];
                    this.displayAnswers(this.answers);
                    this.showToast(`成功导入 ${importedAnswers.length} 条答案`, 'success');
                    this.addLog(`成功导入 ${importedAnswers.length} 条答案`, 'success');
                } else {
                    this.showToast('无效的答案文件格式', 'error');
                }
            } catch (error) {
                this.showToast('答案文件解析失败', 'error');
                this.addLog(`答案文件解析失败: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
    }

    displayAnswers(answers, sortMode = 'file') {
        const container = document.getElementById('answersContainer');
        if (!container) return;
        
        if (!answers || answers.length === 0) {
            container.innerHTML = `
                <div class="no-answers">
                    <i class="bi bi-inbox"></i>
                    <p>暂无答案数据</p>
                    <small>启动代理后开始练习即可自动获取答案</small>
                </div>
            `;
            return;
        }
        
        // 根据排序模式组织答案
        let groupedAnswers = {};
        
        if (sortMode === 'file') {
            answers.forEach(answer => {
                const fileName = answer.file || '未知文件';
                if (!groupedAnswers[fileName]) {
                    groupedAnswers[fileName] = [];
                }
                groupedAnswers[fileName].push(answer);
            });
        } else {
            answers.forEach(answer => {
                const pattern = answer.pattern || '未知题型';
                if (!groupedAnswers[pattern]) {
                    groupedAnswers[pattern] = [];
                }
                groupedAnswers[pattern].push(answer);
            });
        }
        
        let html = '';
        Object.keys(groupedAnswers).forEach(groupName => {
            const groupAnswers = groupedAnswers[groupName];
            html += `
                <div class="answer-group">
                    <div class="group-header">
                        <h4>
                            <i class="bi bi-${sortMode === 'file' ? 'file-text' : 'list-check'}"></i>
                            ${groupName}
                        </h4>
                        <span class="answer-count">${groupAnswers.length}</span>
                    </div>
                    <div class="answers-list">
                        ${groupAnswers.map((answer, index) => `
                            <div class="answer-item" onclick="app.copyAnswer('${answer.answer || ''}')">
                                <div class="answer-header">
                                    <span class="answer-index">#${index + 1}</span>
                                    <span class="answer-type">${answer.type || '未知'}</span>
                                </div>
                                <div class="answer-content">
                                    ${answer.question ? `<div class="question">${answer.question}</div>` : ''}
                                    <div class="answer">${answer.answer || '无答案'}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    copyAnswer(answer) {
        if (!answer) return;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(answer).then(() => {
                this.showToast('答案已复制到剪贴板', 'success');
            }).catch(() => {
                this.showToast('复制失败', 'error');
            });
        } else {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = answer;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast('答案已复制到剪贴板', 'success');
            } catch (err) {
                this.showToast('复制失败', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    loadRules() {
        const container = document.getElementById('rulesContainer');
        if (!container) return;
        
        // 模拟规则数据
        container.innerHTML = `
            <div class="no-rules">
                <i class="bi bi-collection"></i>
                <p>暂无规则配置</p>
                <small>点击右上角 + 号添加新规则</small>
            </div>
        `;
    }

    loadCommunityRulesets() {
        const container = document.getElementById('rulesetsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                <p>正在加载规则集...</p>
            </div>
        `;
        
        // 模拟加载过程
        setTimeout(() => {
            container.innerHTML = `
                <div class="no-rulesets">
                    <i class="bi bi-cloud"></i>
                    <p>暂无可用规则集</p>
                    <small>请检查网络连接后重试</small>
                </div>
            `;
        }, 2000);
    }

    searchRulesets() {
        const searchInput = document.getElementById('rulesetSearchInput');
        const query = searchInput ? searchInput.value.trim() : '';
        
        if (!query) {
            this.showToast('请输入搜索关键词', 'warning');
            return;
        }
        
        this.showToast(`搜索规则集: ${query}`, 'success');
        this.loadCommunityRulesets();
    }

    clearLogs() {
        if (this.logs.length === 0) {
            this.showToast('暂无日志数据', 'warning');
            return;
        }
        
        this.logs = [];
        this.requestCount = 0;
        this.displayLogs();
        this.updateRequestCount();
        this.showToast('日志已清空', 'success');
    }

    addLog(message, type = 'normal') {
        const timestamp = new Date().toLocaleTimeString();
        const log = {
            message,
            type,
            timestamp
        };
        
        this.logs.unshift(log);
        
        // 限制日志数量
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(0, 1000);
        }
        
        if (type !== 'normal') {
            this.requestCount++;
            this.updateRequestCount();
        }
        
        // 如果当前在日志视图，更新显示
        if (this.currentView === 'logs') {
            this.displayLogs();
        }
    }

    displayLogs() {
        const container = document.getElementById('logsContainer');
        if (!container) return;
        
        if (this.logs.length === 0) {
            container.innerHTML = `
                <div class="log-item">
                    <i class="bi bi-hourglass-split"></i>
                    <span>等待网络请求...</span>
                </div>
            `;
            return;
        }
        
        const html = this.logs.map(log => `
            <div class="log-item ${log.type}">
                <i class="bi bi-${this.getLogIcon(log.type)}"></i>
                <span>[${log.timestamp}] ${log.message}</span>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    getLogIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'x-circle';
            case 'warning': return 'exclamation-triangle';
            case 'important': return 'info-circle';
            default: return 'dot';
        }
    }

    updateRequestCount() {
        const countElement = document.getElementById('requestCount');
        if (countElement) {
            countElement.textContent = this.requestCount;
        }
    }

    updateSettingsUI() {
        // 更新设置界面的值
        const proxyPortInput = document.getElementById('proxyPortInput');
        if (proxyPortInput) {
            proxyPortInput.value = this.settings.proxyPort;
        }
        
        const bucketPortInput = document.getElementById('bucketPortInput');
        if (bucketPortInput) {
            bucketPortInput.value = this.settings.bucketPort;
        }
        
        const autoStartProxy = document.getElementById('autoStartProxy');
        if (autoStartProxy) {
            autoStartProxy.checked = this.settings.autoStartProxy;
        }
        
        const keepCacheFiles = document.getElementById('keepCacheFiles');
        if (keepCacheFiles) {
            keepCacheFiles.checked = this.settings.keepCacheFiles;
        }
        
        const answerCaptureEnabled = document.getElementById('answerCaptureEnabled');
        if (answerCaptureEnabled) {
            answerCaptureEnabled.checked = this.settings.answerCaptureEnabled;
        }
    }

    updateUI() {
        this.updateSettingsUI();
        this.updateRequestCount();
        this.displayAnswers(this.answers);
        this.displayLogs();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('auto366-mobile-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('auto366-mobile-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('messageToast');
        if (!toast) return;
        
        const icon = toast.querySelector('.toast-icon');
        const messageEl = toast.querySelector('.toast-message');
        
        if (icon && messageEl) {
            // 设置图标
            const iconClass = {
                success: 'bi-check-circle',
                error: 'bi-x-circle',
                warning: 'bi-exclamation-triangle',
                info: 'bi-info-circle'
            }[type] || 'bi-info-circle';
            
            icon.className = `toast-icon ${iconClass}`;
            messageEl.textContent = message;
            
            // 设置样式
            toast.className = `toast ${type}`;
            toast.classList.add('show');
            
            // 自动隐藏
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    showLoadingToast(message) {
        const toast = document.getElementById('loadingToast');
        if (!toast) return;
        
        const messageEl = toast.querySelector('.toast-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        toast.classList.add('show');
    }

    hideLoadingToast() {
        const toast = document.getElementById('loadingToast');
        if (toast) {
            toast.classList.remove('show');
        }
    }

    // 模拟添加一些测试数据
    addTestData() {
        // 添加测试答案
        this.answers = [
            {
                file: 'test1.json',
                pattern: '选择题',
                type: 'choice',
                question: '下列哪个选项是正确的？',
                answer: 'A',
                timestamp: new Date().toISOString()
            },
            {
                file: 'test1.json',
                pattern: '填空题',
                type: 'fill',
                question: '请填入正确答案',
                answer: 'correct answer',
                timestamp: new Date().toISOString()
            },
            {
                file: 'test2.json',
                pattern: '选择题',
                type: 'choice',
                question: '这是另一个选择题',
                answer: 'B',
                timestamp: new Date().toISOString()
            }
        ];
        
        // 添加测试日志
        this.addLog('应用启动完成', 'success');
        this.addLog('正在等待网络请求...', 'normal');
    }
}

// 全局应用实例
let app;

// 当设备准备就绪时初始化应用
document.addEventListener('deviceready', function() {
    console.log('Device ready, initializing app...');
    app = new Auto366Mobile();
    app.init();
    
    // 添加测试数据（开发阶段）
    setTimeout(() => {
        app.addTestData();
        app.updateUI();
    }, 3000);
}, false);

// 如果不是Cordova环境，直接初始化
if (!window.cordova) {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM ready, initializing app...');
        app = new Auto366Mobile();
        app.init();
        
        // 添加测试数据（开发阶段）
        setTimeout(() => {
            app.addTestData();
            app.updateUI();
        }, 3000);
    });
}  
  // 清理天学网缓存
    clearFileTemp() {
        this.showLoadingToast('正在清理天学网缓存...');
        
        // 模拟清理过程
        setTimeout(() => {
            this.hideLoadingToast();
            this.showToast('天学网缓存清理完成', 'success');
            this.addLog('天学网缓存清理完成', 'success');
        }, 1500);
    }

    // 上传规则集
    uploadRuleset() {
        this.showToast('上传规则集功能开发中...', 'info');
    }

    // 添加规则集
    addRuleGroup() {
        this.showToast('添加规则集功能开发中...', 'info');
    }

    // 分页功能
    previousPage() {
        this.showToast('上一页功能开发中...', 'info');
    }

    nextPage() {
        this.showToast('下一页功能开发中...', 'info');
    }

    // 浏览缓存路径
    browseCachePath() {
        this.showToast('浏览缓存路径功能在移动端不可用', 'warning');
    }

    // 检查更新
    checkForUpdates() {
        this.showLoadingToast('正在检查更新...');
        
        // 模拟检查更新过程
        setTimeout(() => {
            this.hideLoadingToast();
            this.showToast('当前已是最新版本', 'success');
        }, 2000);
    }

    // 更新设置UI中的新字段
    updateSettingsUI() {
        // 更新设置界面的值
        const proxyPortInput = document.getElementById('proxyPortInput');
        if (proxyPortInput) {
            proxyPortInput.value = this.settings.proxyPort;
        }
        
        const bucketPortInput = document.getElementById('bucketPortInput');
        if (bucketPortInput) {
            bucketPortInput.value = this.settings.bucketPort;
        }
        
        const autoStartProxy = document.getElementById('autoStartProxy');
        if (autoStartProxy) {
            autoStartProxy.checked = this.settings.autoStartProxy;
        }
        
        const keepCacheFiles = document.getElementById('keepCacheFiles');
        if (keepCacheFiles) {
            keepCacheFiles.checked = this.settings.keepCacheFiles;
        }
        
        const answerCaptureEnabled = document.getElementById('answerCaptureEnabled');
        if (answerCaptureEnabled) {
            answerCaptureEnabled.checked = this.settings.answerCaptureEnabled;
        }

        const autoCheckUpdates = document.getElementById('autoCheckUpdates');
        if (autoCheckUpdates) {
            autoCheckUpdates.checked = this.settings.autoCheckUpdates || false;
        }

        const cachePathInput = document.getElementById('cachePathInput');
        if (cachePathInput) {
            cachePathInput.value = this.settings.cachePath || '';
        }
    }

    // 更新按钮图标切换
    updateToggleButton() {
        const toggleBtn = document.getElementById('toggleProxyBtn');
        if (!toggleBtn) return;

        if (this.isProxyRunning) {
            toggleBtn.innerHTML = '<i class="bi bi-stop-circle"></i><span>停止代理</span>';
            toggleBtn.className = 'primary-btn full-width danger';
        } else {
            toggleBtn.innerHTML = '<i class="bi bi-play-circle"></i><span>启动代理</span>';
            toggleBtn.className = 'primary-btn full-width';
        }
    }