# 自动打包部署指南

本文档介绍如何使用 GitHub CLI 和 GitHub Actions 自动打包和发布应用。

## 前置要求

### 1. 安装 GitHub CLI
```bash
# macOS
brew install gh

# Windows (使用 Chocolatey)
choco install gh

# 或者从官网下载: https://cli.github.com/
```

### 2. 登录 GitHub
```bash
gh auth login
```

### 3. 确保项目已推送到 GitHub
```bash
# 如果还没有创建远程仓库
gh repo create file-downloader --public
git remote add origin https://github.com/YOUR_USERNAME/file-downloader.git
git push -u origin main
```

## 自动打包方式

### 方式一：使用自动化脚本（推荐）

1. **给脚本添加执行权限**
```bash
chmod +x scripts/release.sh
```

2. **运行发布脚本**
```bash
./scripts/release.sh
```

脚本会自动：
- 更新版本号
- 创建 Git 标签
- 推送到 GitHub
- 触发自动构建
- 等待构建完成并创建 Release

### 方式二：手动使用 GitHub CLI

1. **更新版本号**
```bash
npm version patch  # 或 minor, major
```

2. **推送标签触发构建**
```bash
git push origin main
git push --tags
```

3. **监控构建状态**
```bash
# 查看所有构建
gh run list --workflow=build.yml

# 监控最新构建
gh run watch $(gh run list --workflow=build.yml --limit=1 --json databaseId --jq '.[0].databaseId')
```

4. **查看构建结果**
```bash
# 查看构建详情
gh run view --web

# 下载构建产物
gh run download
```

### 方式三：手动触发构建

如果不想创建新版本，可以手动触发构建：

```bash
# 触发 workflow_dispatch 事件
gh workflow run build.yml
```

## 构建产物

构建完成后，会生成以下文件：

### macOS
- `文件下载器-{version}.dmg` - macOS 安装包
- `文件下载器-{version}-mac.zip` - macOS 应用压缩包

### Windows  
- `文件下载器 Setup {version}.exe` - Windows 安装程序
- `文件下载器-{version}-win.zip` - Windows 应用压缩包

## GitHub Actions 工作流程

### 触发条件
- **标签推送**: 推送 `v*` 格式的标签时自动构建和发布
- **Pull Request**: 针对 main/master 分支的 PR 会触发构建测试
- **手动触发**: 可以在 GitHub Actions 页面手动触发

### 构建矩阵
- **macOS**: 在 `macos-latest` 上构建 macOS 版本
- **Windows**: 在 `windows-latest` 上构建 Windows 版本

### 发布流程
1. 检出代码
2. 设置 Node.js 环境
3. 安装依赖
4. 构建应用
5. 打包分发版本
6. 上传构建产物
7. 创建 GitHub Release（仅标签推送时）

## 常用命令

### 查看构建状态
```bash
# 列出所有构建
gh run list

# 查看特定构建
gh run view [RUN_ID]

# 实时监控构建
gh run watch [RUN_ID]
```

### 管理 Release
```bash
# 列出所有 Release
gh release list

# 查看特定 Release
gh release view v1.0.0

# 下载 Release 资源
gh release download v1.0.0
```

### 调试构建问题
```bash
# 查看构建日志
gh run view [RUN_ID] --log

# 下载构建产物进行本地测试
gh run download [RUN_ID]
```

## 本地测试构建

在推送到 GitHub 之前，可以本地测试构建：

```bash
# 安装依赖
npm install

# 构建应用
npm run build

# 打包分发版本
npm run dist
```

构建产物会保存在 `release/` 目录中。

## 故障排除

### 构建失败
1. 检查 Node.js 版本是否兼容
2. 确保所有依赖都已正确安装
3. 查看构建日志中的错误信息

### 权限问题
1. 确保 GitHub token 有足够权限
2. 检查仓库设置中的 Actions 权限

### 签名问题（macOS）
如果需要代码签名，需要配置：
1. Apple Developer 证书
2. 在 GitHub Secrets 中添加签名密钥

### 更多帮助
- [GitHub CLI 文档](https://cli.github.com/manual/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Electron Builder 文档](https://www.electron.build/)