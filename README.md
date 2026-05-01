# Auto366 Mobile

天学网自动化答题工具移动版 - 基于Apache Cordova构建的跨平台移动应用

## 项目简介

Auto366 Mobile是Auto366项目的移动版本，使用Apache Cordova技术将原有的桌面应用功能移植到移动设备上。该应用支持Android和iOS平台，提供了移动端优化的用户界面和交互体验。

## 功能特性

### 核心功能

#### Android
- **文件服务管理** - 启动/停止本地文件监听
- **答案自动获取** - 实时提取练习答案
- **规则管理** - 管理自定义规则集
- **社区规则集** - 下载和使用社区共享的规则
- **读写日志** - 实时查看文件读写日志
- **设置管理** - 个性化配置应用参数

#### iOS
- **代理服务管理** - 启动/停止代理服务器
- **答案自动获取** - 实时提取练习答案
- **规则管理** - 管理自定义规则集
- **社区规则集** - 下载和使用社区共享的规则
- **监听日志** - 实时查看网络请求日志
- **设置管理** - 个性化配置应用参数

### 移动端优化
- **响应式设计** - 适配各种屏幕尺寸
- **触摸友好** - 优化的触摸交互体验
- **侧边菜单** - 移动端导航模式
- **手势支持** - 支持滑动、点击等手势
- **离线缓存** - 本地数据存储和缓存
- **深色模式** - 自动适配系统主题

## 技术架构

### 前端技术
- **Apache Cordova** - 跨平台移动应用框架
- **HTML5/CSS3** - 现代Web标准
- **JavaScript ES6+** - 现代JavaScript语法
- **Bootstrap Icons** - 图标库
- **CSS Grid/Flexbox** - 响应式布局

### 插件依赖
- `cordova-plugin-whitelist` - 网络访问控制
- `cordova-plugin-statusbar` - 状态栏控制
- `cordova-plugin-device` - 设备信息
- `cordova-plugin-file` - 文件系统访问
- `cordova-plugin-file-transfer` - 文件传输
- `cordova-plugin-network-information` - 网络状态
- `cordova-plugin-dialogs` - 原生对话框
- `cordova-plugin-vibration` - 震动反馈
- `cordova-plugin-splashscreen` - 启动画面

## 开发环境搭建

### 前置要求
- Node.js (v14+)
- Apache Cordova CLI
- Android SDK (Android开发)
- Xcode (iOS开发，仅macOS)

### 安装步骤

1. **安装Cordova CLI**
   ```bash
   npm install -g cordova
   ```

2. **安装项目依赖**
   ```bash
   cd mobile
   npm install
   ```

3. **添加平台**
   ```bash
   # Android平台
   cordova platform add android
   
   # iOS平台 (仅macOS)
   cordova platform add ios
   ```

4. **安装插件**
   ```bash
   cordova plugin add cordova-plugin-whitelist
   cordova plugin add cordova-plugin-statusbar
   cordova plugin add cordova-plugin-device
   cordova plugin add cordova-plugin-file
   cordova plugin add cordova-plugin-file-transfer
   cordova plugin add cordova-plugin-network-information
   cordova plugin add cordova-plugin-dialogs
   cordova plugin add cordova-plugin-vibration
   cordova plugin add cordova-plugin-splashscreen
   ```

## 构建和运行

### 开发模式
```bash
# 在浏览器中预览
cordova serve

# 在设备上运行（需要连接设备）
cordova run android
cordova run ios
```

### 生产构建
```bash
# 构建Android APK
cordova build android --release

# 构建iOS应用
cordova build ios --release
```

### 调试模式
```bash
# 启用调试模式
cordova run android --debug
cordova run ios --debug
```

## 项目结构

```
android(ios)/
├── config.xml              # Cordova配置文件
├── package.json            # 项目依赖配置
├── www/                    # Web资源目录
│   ├── index.html          # 主页面
│   ├── css/               # 样式文件
│   │   ├── index.css      # 基础样式
│   │   └── mobile.css     # 移动端样式
│   ├── js/                # JavaScript文件
│   │   ├── index.js       # Cordova初始化
│   │   └── mobile-app.js  # 主应用逻辑
│   └── img/               # 图片资源
│       ├── icon.png       # 应用图标
│       └── ...
├── platforms/             # 平台特定代码（自动生成）
└── plugins/               # 插件文件（自动生成）
```

## 配置说明

### config.xml配置
- **应用信息** - 应用名称、版本、描述等
- **平台配置** - Android/iOS特定设置
- **插件配置** - 所需插件列表
- **权限设置** - 应用权限声明
- **CSP设置** - 内容安全策略

### 应用设置
- **代理端口(iOS)** - 默认5291
- **答案服务器端口** - 默认5290
- **自动启动服务** - 默认启用
- **缓存文件保留** - 默认禁用
- **答案获取开关** - 默认启用

## 使用说明

### 基本操作
1. **启动应用** - 点击应用图标启动
2. **打开菜单** - 点击左上角菜单按钮
3. **切换视图** - 在侧边菜单中选择不同功能
4. **启动服务** - 在服务页面点击启动按钮
5. **查看答案** - 在答案获取页面查看提取的答案

### 高级功能
- **导入答案** - 从文件导入答案数据
- **导出答案** - 将答案保存到文件
- **分享答案** - 分享答案到云端
- **规则管理** - 添加和管理自定义规则
- **社区规则** - 下载社区共享的规则集

## 注意事项

### 权限要求
- **网络访问** - 用于代理服务和数据同步
- **文件访问** - 用于答案导入导出
- **存储访问** - 用于本地数据缓存

### 兼容性
- **Android** - 支持Android 5.1+ (API Level 22+)
- **iOS** - 支持iOS 11.0+，需要安装额外软件
- **网络** - 需要WiFi或移动网络连接

### 性能优化
- 使用硬件加速渲染
- 启用WebView缓存
- 优化图片资源大小
- 减少DOM操作频率

## 故障排除

### 常见问题
1. **应用无法启动** - 检查Cordova版本和插件兼容性
2. **文件操作失败(Android)** - 确认存储权限设置
3. **代理连接失败(iOS)** - 确认网络权限和端口设置
4. **答案获取异常** - 检查规则配置和网络连接

### 调试方法
- 使用Chrome DevTools远程调试
- 查看Cordova日志输出
- 启用应用内日志记录
- 使用设备调试工具

## 更新日志

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