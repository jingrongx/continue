# 欢迎使用您的 VS Code 扩展

## 文件夹中的内容

* 此文件夹包含您的扩展所需的所有文件。
* `package.json` - 这是声明您的扩展和命令的清单文件。
  * 示例插件注册了一个命令并定义了其标题和命令名称。通过这些信息，VS Code 可以在命令面板中显示该命令。它还不需要加载插件。
* `src/extension.ts` - 这是您提供命令实现的主文件。
  * 该文件导出一个函数 `activate`，该函数在您的扩展首次被激活时调用（在本例中通过执行命令）。在 `activate` 函数中，我们调用 `registerCommand`。
  * 我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。

## 立即启动并运行

* 按 `F5` 打开一个加载了您扩展的新窗口。
* 通过按下 (`Ctrl+Shift+P` 或在 Mac 上按 `Cmd+Shift+P`) 并输入 `Hello World` 从命令面板运行您的命令。
* 在 `src/extension.ts` 中设置断点以调试您的扩展。
* 在调试控制台中找到来自您扩展的输出。

## 进行更改

* 在 `src/extension.ts` 中更改代码后，您可以从调试工具栏重新启动扩展。
* 您也可以重新加载 (`Ctrl+R` 或在 Mac 上按 `Cmd+R`) VS Code 窗口以加载您的更改。

## 探索 API

* 打开文件 `node_modules/@types/vscode/index.d.ts` 时，您可以打开我们 API 的完整集合。

## 运行测试

* 打开调试视图 (`Ctrl+Shift+D` 或在 Mac 上按 `Cmd+Shift+D`) 并从启动配置下拉菜单中选择 `Extension Tests`。
* 按 `F5` 在加载了您扩展的新窗口中运行测试。
* 在调试控制台中查看测试结果的输出。
* 对 `src/test/suite/extension.test.ts` 进行更改或在 `test/suite` 文件夹中创建新的测试文件。
  * 提供的测试运行器只会考虑名称模式匹配 `**.test.ts` 的文件。
  * 您可以在 `test` 文件夹中创建文件夹以任何您想要的方式组织您的测试。

## 更进一步

* [遵循 UX 指南](https://code.visualstudio.com/api/ux-guidelines/overview) 以创建与 VS Code 原生界面和模式无缝集成的扩展。
* 通过[打包您的扩展](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) 来减少扩展大小并提高启动时间。
* 在 VS Code 扩展市场上[发布您的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
* 通过设置[持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)来自动化构建。