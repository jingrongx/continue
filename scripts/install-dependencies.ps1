# 这个脚本在 Windows 上用于 .vscode/tasks.json 中的一个任务
# 开始开发：
# - 运行任务 -> 安装依赖
# - 调试 -> 扩展

# 所有内容都需要 node 和 npm
Write-Host "`n检查可能需要手动安装的依赖项...`n" -ForegroundColor White

# 检查 node 是否存在
$node  = (get-command node -ErrorAction SilentlyContinue)
if ($null -eq $node) {
    Write-Host "未找到 " -ForegroundColor Red -NoNewLine
    Write-Host "node"
} else {
    Write-Host "找到 " -ForegroundColor Green -NoNewLine
    Write-Host "node "  -NoNewLine
    & node --version
}

# 如果 node 未找到，提示安装
if ($null -eq $node) {
    Write-Host "`n...`n"
    Write-Host "NodeJS`n" -ForegroundColor White
    Write-Host "似乎未安装或不在您的路径中。"
    Write-Host "在大多数 Windows 系统上，您可以使用以下命令安装 node：" -NoNewLine
    Write-Host "winget install OpenJS.NodeJS.LTS " -ForegroundColor Green
    Write-Host "安装后，重启终端以更新路径。"
    Write-Host "或者请参见：" -NoNewLine
    Write-Host "https://nodejs.org/" -ForegroundColor Yellow
}

# 如果 node 未找到，退出脚本
if (($null -eq $node)) {
    return "`n未找到可能需要安装的一些依赖项。退出"
}

# 安装核心扩展依赖项
Write-Host "`n正在安装核心扩展依赖项..." -ForegroundColor White
Push-Location core
npm install
npm link
Pop-Location

# 安装 GUI 扩展依赖项
Write-Output "`n正在安装 GUI 扩展依赖项..." -ForegroundColor White
Push-Location gui
npm install
npm link @continuedev/core
npm run build
Pop-Location

# 安装 VSCode 扩展依赖项（也会打包 GUI）
Write-Output "`n正在安装 VSCode 扩展依赖项..." -ForegroundColor White
Push-Location extensions/vscode

# 这个过程做了很多事情，但它是许多脚本之间的共同点
npm install
npm link @continuedev/core
npm run prepackage
npm run package

Pop-Location

# 安装二进制依赖项
Write-Output "`n正在安装二进制依赖项..." -ForegroundColor White
Push-Location binary

npm install
npm run build

Pop-Location

# 安装文档依赖项
Write-Output "`n正在安装文档依赖项..." -ForegroundColor White
Push-Location docs

npm install
