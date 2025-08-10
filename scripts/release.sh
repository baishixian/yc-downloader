#!/bin/bash

# 自动打包和发布脚本
# 使用 GitHub CLI 自动触发构建和发布

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 文件下载器自动打包脚本${NC}"

# 检查是否安装了 GitHub CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI 未安装，请先安装 GitHub CLI${NC}"
    echo "安装方法: https://cli.github.com/"
    exit 1
fi

# 检查是否已登录 GitHub
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  请先登录 GitHub CLI${NC}"
    echo "运行: gh auth login"
    exit 1
fi

# 获取当前版本号
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}📦 当前版本: v${CURRENT_VERSION}${NC}"

# 询问新版本号
echo -n "请输入新版本号 (当前: ${CURRENT_VERSION}): "
read NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo -e "${RED}❌ 版本号不能为空${NC}"
    exit 1
fi

# 更新 package.json 版本号
echo -e "${YELLOW}📝 更新版本号到 v${NEW_VERSION}${NC}"
npm version $NEW_VERSION --no-git-tag-version

# 提交更改
echo -e "${YELLOW}📤 提交版本更新${NC}"
git add package.json
git commit -m "chore: bump version to v${NEW_VERSION}"

# 创建并推送标签
echo -e "${YELLOW}🏷️  创建标签 v${NEW_VERSION}${NC}"
git tag "v${NEW_VERSION}"
git push origin main
git push origin "v${NEW_VERSION}"

echo -e "${GREEN}✅ 标签已推送，GitHub Actions 将自动开始构建${NC}"

# 等待构建完成
echo -e "${YELLOW}⏳ 等待构建完成...${NC}"
echo "你可以通过以下命令查看构建状态:"
echo "gh run list --workflow=build.yml"

# 询问是否等待并自动创建 Release
echo -n "是否等待构建完成并自动创建 Release? (y/N): "
read WAIT_FOR_BUILD

if [[ $WAIT_FOR_BUILD =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏳ 监控构建状态...${NC}"
    
    # 等待最新的 workflow run 完成
    WORKFLOW_ID=$(gh run list --workflow=build.yml --limit=1 --json databaseId --jq '.[0].databaseId')
    
    if [ -n "$WORKFLOW_ID" ]; then
        gh run watch $WORKFLOW_ID
        
        # 检查构建是否成功
        STATUS=$(gh run view $WORKFLOW_ID --json conclusion --jq '.conclusion')
        
        if [ "$STATUS" = "success" ]; then
            echo -e "${GREEN}✅ 构建成功完成！${NC}"
            echo -e "${GREEN}🎉 Release v${NEW_VERSION} 已自动创建${NC}"
            
            # 打开 Release 页面
            REPO_URL=$(gh repo view --json url --jq '.url')
            echo -e "${GREEN}📱 Release 地址: ${REPO_URL}/releases/tag/v${NEW_VERSION}${NC}"
        else
            echo -e "${RED}❌ 构建失败，状态: ${STATUS}${NC}"
            echo "请检查构建日志: gh run view $WORKFLOW_ID"
        fi
    else
        echo -e "${RED}❌ 无法找到对应的 workflow run${NC}"
    fi
fi

echo -e "${GREEN}🎊 完成！${NC}"