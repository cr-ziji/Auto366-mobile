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
        
        console.log('Auto366Mobile initialized');
    }

    init() {
        console.log('Initializing Auto366Mobile...');
        
        // 检查DOM是否准备就绪
        if (document.readyState === 'loading') {
            console.log('DOM still loading, waiting...');
            document.addEventListener('DOMContentLoaded', () => {
                this.initAfterDOM();
            });
        } else {
            this.initAfterDOM();
        }
    }
    
    initAfterDOM() {
        console.log('DOM ready, initializing app...');
        
        // 初始化黑暗模式
        this.initDarkMode();
        
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

    initDarkMode() {
        // 检测系统黑暗模式偏好
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // 如果系统偏好黑暗模式，添加dark-mode类作为备用
        if (prefersDark) {
            document.documentElement.classList.add('dark-mode');
        }
        
        // 监听系统主题变化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (e.matches) {
                document.documentElement.classList.add('dark-mode');
            } else {
                document.documentElement.classList.remove('dark-mode');
            }
        });
    }

    initEventListeners() {
        console.log('Initializing event listeners...');
        
        // 菜单控制
        const menuToggle = document.getElementById('menuToggle');
        const menuClose = document.getElementById('menuClose');
        const menuOverlay = document.getElementById('menuOverlay');
        
        console.log('Menu elements found:', {
            menuToggle: !!menuToggle,
            menuClose: !!menuClose,
            menuOverlay: !!menuOverlay
        });
        
        if (menuToggle) {
            // 使用touchstart而不是click来提高响应速度
            menuToggle.addEventListener('touchstart', (e) => {
                console.log('Menu toggle touched');
                e.preventDefault();
                e.stopPropagation();
                this.toggleMenu();
            }, { passive: false });
            
            // 保留click事件作为备用（用于鼠标操作）
            menuToggle.addEventListener('click', (e) => {
                console.log('Menu toggle clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleMenu();
            });
        } else {
            console.error('menuToggle element not found!');
        }
        
        if (menuClose) {
            menuClose.addEventListener('touchstart', (e) => {
                console.log('Menu close touched');
                e.preventDefault();
                e.stopPropagation();
                this.closeMenu();
            }, { passive: false });
            
            menuClose.addEventListener('click', (e) => {
                console.log('Menu close clicked');
                e.preventDefault();
                e.stopPropagation();
                this.closeMenu();
            });
        }
        
        if (menuOverlay) {
            menuOverlay.addEventListener('click', () => {
                console.log('Menu overlay clicked');
                this.closeMenu();
            });
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

        // 清理天学网缓存按钮
        const deleteFileTempBtn = document.getElementById('deleteFileTempBtn');
        if (deleteFileTempBtn) {
            deleteFileTempBtn.addEventListener('click', () => {
                this.clearFileTemp();
            });
        }

        console.log('Event listeners initialized');
    }

    initSwipeGestures() {
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let isDragging = false;
        
        const app = document.getElementById('app');
        if (!app) return;
        
        app.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
            isDragging = false;
        }, { passive: true });
        
        app.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = currentX - startX;
            const diffY = currentY - startY;
            
            // 检查是否主要是水平滑动
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 20) {
                isDragging = true;
                const isMenuOpen = document.getElementById('sideMenu').classList.contains('open');
                
                // 从左边缘开始的右滑手势
                if (startX < 30 && diffX > 20 && !isMenuOpen) {
                    e.preventDefault();
                }
                // 菜单打开时的左滑手势
                else if (diffX < -20 && isMenuOpen) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
        
        app.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const endTime = Date.now();
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            const timeDiff = endTime - startTime;
            const velocity = Math.abs(diffX) / timeDiff; // 像素/毫秒
            
            // 更敏感的判定条件：时间更短或速度更快
            const isQuickSwipe = timeDiff < 200 || velocity > 0.3;
            const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50;
            
            if (isQuickSwipe && isHorizontalSwipe) {
                const isMenuOpen = document.getElementById('sideMenu').classList.contains('open');
                
                // 从左边缘向右滑动打开菜单（更宽的触发区域）
                if (startX < 40 && diffX > 50 && !isMenuOpen) {
                    e.preventDefault();
                    this.openMenu();
                }
                // 向左滑动关闭菜单
                else if (diffX < -50 && isMenuOpen) {
                    e.preventDefault();
                    this.closeMenu();
                }
            }
            
            // 重置
            startX = 0;
            startY = 0;
            startTime = 0;
            isDragging = false;
        }, { passive: false });
    }

    toggleMenu() {
        console.log('toggleMenu called');
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        
        console.log('Menu elements in toggle:', {
            sideMenu: !!sideMenu,
            menuOverlay: !!menuOverlay,
            isOpen: sideMenu ? sideMenu.classList.contains('open') : false
        });
        
        if (sideMenu && menuOverlay) {
            const isOpen = sideMenu.classList.contains('open');
            if (isOpen) {
                this.closeMenu();
            } else {
                this.openMenu();
            }
        } else {
            console.error('Menu elements not found in toggleMenu');
        }
    }

    openMenu() {
        console.log('openMenu called');
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        
        if (sideMenu && menuOverlay) {
            sideMenu.classList.add('open');
            menuOverlay.classList.add('show');
            console.log('Menu opened');
            
            // 添加触觉反馈（如果支持）
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        }
    }

    closeMenu() {
        console.log('closeMenu called');
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        
        if (sideMenu && menuOverlay) {
            sideMenu.classList.remove('open');
            menuOverlay.classList.remove('show');
            console.log('Menu closed');
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

    clearCache() {
        this.showLoadingToast('正在清理缓存...');
        
        // 模拟清理过程
        setTimeout(() => {
            this.hideLoadingToast();
            this.showToast('缓存清理完成', 'success');
            this.addLog('缓存清理完成', 'success');
        }, 1000);
    }

    clearFileTemp() {
        this.showLoadingToast('正在清理天学网缓存...');
        
        // 模拟清理过程
        setTimeout(() => {
            this.hideLoadingToast();
            this.showToast('天学网缓存清理完成', 'success');
            this.addLog('天学网缓存清理完成', 'success');
        }, 1500);
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

    updateUI() {
        this.updateRequestCount();
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

    // 显示加载提示
    showLoadingToast(message) {
        const toast = document.getElementById('loadingToast');
        if (!toast) return;
        
        const messageEl = toast.querySelector('.toast-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        toast.classList.add('show');
    }

    // 隐藏加载提示
    hideLoadingToast() {
        const toast = document.getElementById('loadingToast');
        if (toast) {
            toast.classList.remove('show');
        }
    }

    // 显示消息提示
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
}

// 导出类供全局使用
window.Auto366Mobile = Auto366Mobile;