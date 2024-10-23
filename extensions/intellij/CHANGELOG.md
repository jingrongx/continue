所有对该项目的重要更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)，
遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)，
并由 [Changie](https://github.com/miniscruff/changie) 生成。

预发布更改
### 更改
* 更新了教程文件
### 修复
* 修复了在 JetBrains IDE 中加载 config.ts 的能力

## 0.0.69 - 2024-09-22
### 新增
* 支持 "search" 上下文提供者
### 修复
* 修复了仅识别第一个模块的错误
* 改进了并发处理以避免冻结
* 使其与最新的 JetBrains 版本兼容

## 0.0.54 - 2024-07-13
### 新增
* 部分自动完成接受
* 自动完成状态栏旋转器
### 修复
* 修复了重复完成错误及其他问题

## 0.0.53 - 2024-07-10
### 新增
* 支持 .prompt 文件
* 新的入门体验
### 修复
* 将 VS Code 版本的索引修复合并到 IntelliJ
* 改进了代码库索引的可靠性和测试
* 修复了自动完成文本定位和时机的问题

## 0.0.42 - 2024-04-12
### 新增
* JetBrains 中的内联 cmd/ctrl+I
### 修复
* 修复了导致显示问题的字符编码错误
* 修复了导致输入不断要求焦点的错误
* 修复了 config.json 的自动重新加载

## 0.0.38 - 2024-03-15
### 新增
* 远程配置服务器支持
* JetBrains 中的自动完成支持

## 0.0.34 - 2024-03-03
### 新增
* diff 上下文提供者
### 更改
* 允许 LLM 服务器处理模板
### 修复
* 修复了一些上下文提供者/斜杠命令的问题
* 修复了阻止扩展正常启动的问题

## v0.0.26 - 2023-12-28
### 新增
* 保存时自动重新加载配置
### 修复
* 修复了没有 Python 服务器版本的 /edit 错误

## v0.0.25 - 2023-12-25

### 更改

- Intellij 扩展不再依赖 Continue Python 服务器

## v0.0.21 - 2023-12-05

### 新增

- 更新以匹配最新的 VS Code 更新

## v0.0.19 - 2023-11-19

### 更改

- 迁移到 .json 配置文件格式

## v0.0.1 - 2023-09-01

### 新增

- 从 [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template) 创建的初始框架