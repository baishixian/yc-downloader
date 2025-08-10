#!/bin/bash

# 设置环境变量来减少 macOS 上的 Electron 警告
export ELECTRON_DISABLE_SECURITY_WARNINGS=true
export ELECTRON_NO_ATTACH_CONSOLE=true
export ELECTRON_ENABLE_LOGGING=false

# 编译 TypeScript 代码
echo "编译 TypeScript 代码..."
npx tsc -p tsconfig.json

# 启动 Electron 应用
echo "启动 Electron 应用..."
npx electron .

echo "应用已关闭" 