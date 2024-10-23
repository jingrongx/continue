# Continue VS Code 扩展

这是 Continue VS Code 扩展。其主要任务是：

1. 实现 Continue IDE 协议的 IDE 端，允许 Continue 服务器在 IDE 中进行本地交互。这在 `src/continueIdeClient.ts` 中实现。
2. 在侧边面板中打开 Continue React 应用。React 应用的源代码位于 `gui` 目录中。面板通过 `continue.openContinueGUI` 命令打开，该命令在 `src/commands.ts` 中定义。

# 如何运行扩展

请参阅[环境设置](../../CONTRIBUTING.md#environment-setup)

# 如何运行和调试测试

在按照[环境设置](../../CONTRIBUTING.md#environment-setup)中的设置操作后，您可以在 VS Code 中运行 `Extension (VSCode)` 启动配置。

## 注意事项

- 我们要求 vscode 引擎版本 `^1.67.0`，并使用 `@types/vscode` 版本 `1.67.0`，因为这是不破坏我们正在使用的任何 API 的最早版本。如果回到 `1.66.0`，则会破坏 `vscode.window.tabGroups`。