# macOS 代码签名配置指南

## 问题描述
当你在 macOS 上运行应用程序时，可能会遇到以下错误：
```
"File Downloader"已损坏，无法打开。你应该将它移到废纸篓。
```

这是因为应用程序没有经过 Apple 代码签名，被 macOS 的 Gatekeeper 安全机制阻止。

## 立即解决方案（绕过 Gatekeeper）

### 方法1：使用终端命令
```bash
# 移除应用程序的隔离属性
sudo xattr -rd com.apple.quarantine "/Applications/File Downloader.app"
```

### 方法2：通过系统设置
1. 右键点击应用程序，选择"打开"
2. 在弹出的警告对话框中点击"打开"
3. 或者在"系统设置" > "隐私与安全性"中允许该应用运行

### 方法3：临时禁用 Gatekeeper（不推荐）
```bash
# 禁用 Gatekeeper
sudo spctl --master-disable

# 重新启用 Gatekeeper
sudo spctl --master-enable
```

## 长期解决方案（配置代码签名）

### 前提条件
- 拥有 Apple Developer 账号（$99/年）
- 安装 Xcode 或 Xcode Command Line Tools

### 步骤1：获取开发者证书
1. 登录 [Apple Developer Portal](https://developer.apple.com/)
2. 创建 "Developer ID Application" 证书
3. 下载并安装证书到钥匙串

### 步骤2：配置环境变量
在你的 `.zshrc` 或 `.bash_profile` 中添加：
```bash
# Apple Developer 证书信息
export CSC_IDENTITY_AUTO_DISCOVERY=false
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

### 步骤3：创建应用专用密码
1. 访问 [Apple ID 管理页面](https://appleid.apple.com/)
2. 登录后选择"登录和安全"
3. 在"应用专用密码"部分生成新密码
4. 将密码设置为 `APPLE_ID_PASSWORD` 环境变量

### 步骤4：更新 GitHub Actions（如果使用）
在 `.github/workflows/build.yml` 中添加签名配置：
```yaml
- name: Build macOS app
  env:
    CSC_IDENTITY_AUTO_DISCOVERY: false
    CSC_NAME: ${{ secrets.CSC_NAME }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: npm run dist
```

并在 GitHub 仓库设置中添加对应的 Secrets。

### 步骤5：本地构建测试
```bash
# 构建签名版本
npm run dist

# 验证签名
codesign -dv --verbose=4 "release/File Downloader-1.0.6-arm64-mac.dmg"
spctl -a -t open --context context:primary-signature "release/File Downloader-1.0.6-arm64-mac.dmg"
```

## 配置说明

项目已经预配置了以下代码签名设置：
- `hardenedRuntime: true` - 启用强化运行时
- `gatekeeperAssess: false` - 跳过 Gatekeeper 评估（开发阶段）
- `entitlements` - 应用权限配置文件

## 注意事项

1. **开发阶段**：可以使用绕过 Gatekeeper 的方法
2. **生产发布**：强烈建议配置代码签名和公证
3. **证书管理**：确保证书有效期内，及时续费
4. **权限配置**：根据应用需求调整 entitlements.mac.plist

## 故障排除

### 常见错误
1. **证书未找到**：检查证书是否正确安装在钥匙串中
2. **权限不足**：确保证书具有代码签名权限
3. **网络问题**：公证过程需要稳定的网络连接

### 调试命令
```bash
# 查看可用证书
security find-identity -v -p codesigning

# 验证应用签名
codesign -dv --verbose=4 "path/to/your/app.app"

# 检查公证状态
xcrun altool --notarization-info "request-id" -u "your-apple-id" -p "app-password"
```