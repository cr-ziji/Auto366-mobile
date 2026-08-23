# Auto366 Mobile

天学网自动化答题工具移动版 - 基于 Capacitor 构建的跨平台移动应用

## 项目简介

Auto366 Mobile 是 Auto366 项目的移动版本，使用 Capacitor 技术将原有的桌面应用功能移植到移动设备上。该应用目前支持 Android 平台，提供了移动端优化的用户界面和交互体验。

> 历史说明：本项目早期基于 Apache Cordova，现已迁移至 Capacitor。迁移后 Web 层（www/）保持纯静态 HTML/JS，无需 Vite 等打包器；原生能力通过自定义插件 FlipbookScanner 与 Capacitor 官方插件提供。

## 功能特性

### 核心功能 (Android)

- **文件监听** - 监听练习数据目录，自动发现新目录
- **答案自动获取** - 实时提取并解析练习答案
- **画中画模式** - 支持手动进入与"离开应用自动进入"，浮窗内可上下滚动答题
- **SAF 存储访问** - Android 11+ 通过 SAF 访问练习目录
- **读写日志** - 实时查看扫描与解析日志
- **设置管理** - 个性化配置应用参数

### 移动端优化

- **响应式设计** - 适配各种屏幕尺寸
- **触摸友好** - 优化的触摸交互体验
- **侧边菜单** - 移动端导航模式
- **离线缓存** - 本地数据存储和缓存
- **深色模式** - 自动适配系统主题

## 技术架构

### 前端技术
- **Capacitor 8** - 跨平台原生桥接框架
- **HTML5/CSS3** - 现代Web标准
- **JavaScript ES6+** - 现代JavaScript语法（无打包器，直接运行源码）
- **Bootstrap Icons** - 图标库

### 原生插件

| 插件 | 说明 |
|------|------|
| `FlipbookScanner` (自定义) | 目录树扫描(listTree)、文件读取、SAF、权限、画中画状态同步 |
| `@capacitor/app` | 返回键、应用生命周期 |
| `@capacitor/status-bar` | 状态栏样式 |
| `@capacitor/splash-screen` | 启动屏控制 |
| `@capacitor/dialog` | 原生确认对话框 |

> 插件通过原生层注入的 `window.Capacitor.Plugins.*` 全局桥接对象调用，
> www/js/flipbook-native.js 对其做了懒解析封装，对外保持回调式 API。

## 开发环境搭建

### 前置要求
- Node.js (v18+)
- Android SDK（Android 开发）
- JDK 17+

### 安装步骤

1. **安装项目依赖**
   ```bash
   npm install
   ```

2. **修改 Web 资产后同步到原生工程**
   ```bash
   npx cap copy android     # 仅拷贝 www/ 到 android/assets/public/
   npx cap sync android     # 拷贝 + 更新原生插件依赖（改动插件配置后用）
   ```

3. **添加平台（新环境）**
   ```bash
   npx cap add android
   ```

## 构建和运行

```bash
# 构建 Debug APK
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
# 产物: android/app/build/outputs/apk/debug/app-debug.apk

# 构建 Release APK
./gradlew assembleRelease

# 直接安装到连接的设备
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 调试

- Chrome 打开 `chrome://inspect` 可直接调试设备上的 WebView（Debug 构建已开启）
- 原生日志: `adb logcat -s Capacitor MainActivity CapConfig`
- 应用内日志: 服务页面的日志面板实时显示扫描/解析过程

## 项目结构

```
Auto366-mobile/
├── capacitor.config.json      # Capacitor 配置
├── package.json               # npm 依赖（仅 Capacitor CLI 与官方插件）
├── www/                       # Web 资源目录（webDir）
│   ├── index.html             # 主页面
│   ├── css/                   # 样式文件
│   ├── js/
│   │   ├── index.js           # 应用启动引导、生命周期、返回键处理
│   │   ├── app.js             # 主应用逻辑（UI、监听循环、画中画）
│   │   ├── answer.js          # 答案解析引擎
│   │   ├── crypto.js          # 解密工具
│   │   └── flipbook-native.js # 原生插件桥接封装
│   └── lib/                   # 第三方库
└── android/                   # Android 原生工程
    └── app/src/main/java/com/auto366/
        ├── mobile/MainActivity.java        # 画中画、滚动广播
        └── flipbook/FlipbookScannerPlugin.java  # 自定义存储/画中画插件
```

## 存储访问模式

| 模式 | 适用场景 | 说明 |
|------|----------|------|
| SAF 模式 | **Android 11+ 推荐** | 通过系统文件选择器授权目录，稳定可靠 |
| 全部文件访问 | Android 10 及以下 / 已授予 MANAGE_EXTERNAL_STORAGE 的设备 | 直接路径访问 |
| 零宽字符路径 | 部分 ROM 的辅助手段 | 在 Android 11+ 上无效，建议关闭 |

**Android 11+ 用户请开启 SAF 模式并在首次启动监听时选择练习目录**
（通常是 `/storage/emulated/0/Android/data/com.up366.mobile/files/flipbook`）。

## 使用说明

### 基本操作
1. **启动应用** - 点击应用图标启动
2. **打开菜单** - 点击左上角菜单按钮
3. **切换视图** - 在侧边菜单中选择不同功能
4. **启动监听** - 在服务页面点击开始按钮
5. **查看答案** - 在答案获取页面查看提取的答案

### 画中画（小窗）模式
- **手动进入**: 开始监听后点击"进入画中画"按钮
- **自动进入**: 设置中开启"离开应用自动进入画中画"后，监听期间上划回到桌面会自动以小窗继续运行
  - Android 12+: 系统级无缝自动进入（setAutoEnterEnabled）
  - Android 11 及以下: 通过 onUserLeaveHint 触发
- **小窗内操作**: 点击小窗的上/下按钮或滑动来滚动页面；上滑小窗可退出

### 高级功能
- **导入答案** - 从文件导入答案数据
- **导出答案** - 将答案保存到文件
- **规则管理** - 添加和管理自定义规则
- **社区规则** - 下载社区共享的规则集

## 注意事项

### 权限要求
- **网络访问** - 用于数据同步
- **存储访问** - 用于监听练习目录（Android 11+ 建议 SAF 授权）
- **画中画** - 系统设置中需允许该应用出现在其他应用上层

### 兼容性
- **Android** - 支持 Android 7.0+ (API 24+)，画中画需要 Android 8.0+
- **网络** - 需要WiFi或移动网络连接

## 故障排除

### 常见问题
1. **无法开始监听(Android 11+)** - 请开启 SAF 模式并选择正确目录；不要依赖零宽字符路径
2. **监听到但未提取出答案** - 查看日志面板中的解析输出，确认练习数据格式受支持
3. **上划没有进入画中画** - 确认①正在监听中 ②已开启"离开应用自动进入画中画" ③系统未禁止该应用画中画
4. **小窗内滚动无效** - 部分系统在小窗刚出现的一瞬间不响应点击，稍等片刻再操作
5. **启动屏显示异常** - 清除桌面启动器的缓存后重试

### 调试方法
- 使用 Chrome DevTools 远程调试 WebView
- `adb logcat` 查看原生日志（画中画相关过滤 `MainActivity`）
- 启用应用内日志记录

## 更新日志

### v2.0.0 (2026-08)
- 迁移至 Capacitor 8
- 重写目录监听为 listTree 单次桥接调用（性能大幅优化）
- 新增 SAF 存储模式（Android 11+）
- 新增画中画模式与小窗内滚动
- 新增离开应用自动进入画中画

### v1.0.0 (2024-03-08)
- 初始版本发布
- 实现基础代理功能
- 添加答案获取功能
- 支持规则管理
- 优化移动端UI/UX

## 许可证

本项目采用 GNU General Public License v3.0 许可证 - 查看 [LICENSE](../LICENSE) 文件了解详情。

## 免责声明

本工具仅供学习和研究使用，使用者需自行承担使用风险，开发者不承担任何法律责任。严禁用于商业用途。

## 贡献指南

欢迎提交Issue和Pull Request来改进项目。请确保：
- 遵循现有代码风格
- 添加适当的测试
- 更新相关文档
- 描述清楚变更内容

## 联系方式

- **GitHub**: [cyrilguocode/Auto366](https://github.com/cyrilguocode/Auto366)
- **Issues**: [项目Issues页面](https://github.com/cyrilguocode/Auto366/issues)

---

**注意**: 本移动版本是Auto366项目的扩展，主要功能与桌面版保持一致，但针对移动设备进行了界面和交互优化。
