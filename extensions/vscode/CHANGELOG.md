所有对该项目的重要更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)，
遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)，
并由 [Changie](https://github.com/miniscruff/changie) 生成。

## 0.8.54 - 2024-10-15
### 修复
* 热修复：限制 transformers.js embeddings 提供者

## 0.8.53 - 2024-10-11
### 新增
* 改进 apply 的加载/接受/拒绝 UI
* 优化聊天侧边栏，特别是上下文下拉菜单
* 进一步缓存 Anthropic 的提示
### 更改
* 更新教程文件
* 改进“更多”页面的样式
### 修复
* 团队认证错误修复
* 修复了一些 apply 的错误
* 修复自动滚动行为

## 0.8.52 - 2024-09-16
### 更改
* 仅在询问用户后使用 Chromium 作为后备
* 重新设计的入门流程

## 0.8.51 - 2024-09-05
### 修复
* 修复 CRLF 错误导致在 Windows 上每行都被视为更改的问题

## 0.8.50 - 2024-09-02
### 修复
* 热修复以允许使用多个内联上下文提供者

## 0.8.49 - 2024-09-01
### 修复
* 热修复：子菜单上下文提供者

## 0.8.48 - 2024-09-01
### 新增
* 改进的索引进度 UI
* 改进的 @codebase 使用 repomap
* Repo map 上下文提供者
### 修复
* 许多小的 UI 改进
* 修复 db.search 不是一个函数

## 0.8.47 - 2024-08-27
### 新增
* 使用无头浏览器进行爬网以获得更好的结果
* 聊天窗口中的 TTS 支持
### 更改
* 改进对 WatsonX 模型的支持
### 修复
* 修复了几个小的索引错误

## 0.8.46 - 2024-08-11
### 新增
* 新的 /onboard 斜杠命令
### 修复
* 修复加载 config.ts 的问题
* 修复导致重复索引工作的错误

## 0.8.45 - 2024-08-05
### 新增
* 支持 Llama 3.1 和 gpt-4o-mini
* 支持 WatsonX+Granite 模型
### 更改
* 显著提高索引性能
* 通过更准确地搜索文件名和路径来改进 @codebase 质量
* 改进 @codebase 准确性
* 进一步提高索引性能
### 修复
* 改进文档索引和管理
* 修复 Gemini embeddings 提供者

## 0.8.43 - 2024-07-08
### 新增
* 改进的索引可靠性和测试
* 快速操作：使用 CodeLens 快速执行常见操作，如添加文档字符串

## 0.8.42 - 2024-07-02
### 新增
- 支持 Gemini 1.5 Pro
- 在使用 codebase 检索时在侧边栏中链接到代码
- 更顺畅的入门体验
- .prompt 文件，一种保存和共享斜杠命令的方法
- 支持 Claude 3.5 Sonnet、Deepseek Coder v2 和其他新模型
- 支持在 config.json 中的注释
- 指定多个自动完成模型并在它们之间切换
- 改进的括号匹配策略减少了噪声完成

### 修复
- 代码库索引的众多可靠性升级

## 0.8.24 - 2024-04-12
### 新增
* 支持改进的检索模型（Voyage embeddings/reranking）
* 新的 @code 上下文提供者
* 个人使用分析

## 0.8.15 - 2024-03-05
### 新增
* Tab 自动完成测试版

## 0.8.14 - 2024-03-03
### 新增
* 图像支持
* 用于检索的全文搜索索引
* 文档上下文提供者
* CodeLlama-70b 支持
### 更改
* config.ts 仅在 NodeJS 中运行，而不是浏览器中
### 修复
* 修复 config.json 中的代理设置

## v0.8.2 - 2024-01-23
### 新增
* 将 codellama 和 gemini 添加到免费试用中，使用新服务器
* 使用 LanceDB 的本地代码库同步和 embeddings
* 改进的 VS Code 主题匹配
### 更改
* 更新打包以下载当前平台的本机模块（lancedb、sqlite、onnxruntime、tree-sitter wasms）
* 上下文提供者现在从扩展端运行（在 Node.js 中而不是浏览器 javascript）

## v0.8.1 - 2024-01-08
### 新增
- 在 config.json 中禁用 disableSessionTitles 选项

### 更改
- 默认使用 Ollama /chat 端点而不是原始完成，并使用 /show 端点收集模型参数，如上下文长度和停止标记

## v0.6.19 - 2024-01-05
### 新增
- 支持在工作区根目录中的 .continuerc.json 以覆盖 config.json
- 内联上下文提供者
- 使用新的差异流 UI 进行编辑的 cmd+shift+L

### 更改
- 允许某些 LLM 服务器处理模板

## v0.6.16 - 2023-12-25
### 更改
- 上下文项目现在作为过去消息的一部分保留，而不是停留在主输入中
- 不再需要 Python 服务器 - Continue 完全在 Typescript 中运行

## v0.6.4 - 2023-11-19
### 更改
- 迁移到 .json 配置文件格式

## v0.6.0 - 2023-11-10
### 新增
- 全屏模式
- StackOverflow 斜杠命令以通过网络搜索增强
- VS Code 上下文菜单：右键单击以将代码添加到上下文中，调试终端或共享您的 Continue 会话

### 修复
- 通过与 socket.io 重构保持最新来提高 JetBrains 的可靠性

## v0.5.0 - 2023-11-09
### 新增
- 代码库检索：使用 /codebase 或 cmd+enter，Continue 将自动收集最重要的上下文

### 更改
- 从 Websockets 切换到 Socket.io