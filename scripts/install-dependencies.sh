#!/usr/bin/env bash
# 这个脚本在 .vscode/tasks.json 中的一个任务中使用
# 开始开发：
# - 运行任务 -> 安装依赖
# - 调试 -> 扩展
set -e

echo "安装核心扩展依赖..."
pushd core
## 由于我们在运行时下载 Chromium，因此设置此标志
export PUPPETEER_SKIP_DOWNLOAD='true'
npm install
npm link

popd

echo "安装 GUI 扩展依赖..."
pushd gui
npm install
npm link @continuedev/core
npm run build

popd

# VSCode 扩展（也将打包 GUI）
echo "安装 VSCode 扩展依赖..."
pushd extensions/vscode
# 这里内联做了太多事情，但这是许多脚本之间的共同点
npm install
npm link @continuedev/core
npm run prepackage
npm run package

popd

echo "安装二进制依赖..."
pushd binary
npm install
npm run build

popd

echo "安装文档依赖..."
pushd docs
npm install
