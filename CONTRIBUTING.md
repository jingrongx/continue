# 贡献指南

## 目录

- [贡献指南](#贡献指南)
  - [目录](#目录)
- [❤️ 贡献方式](#️-贡献方式)
  - [👋 贡献创意](#-贡献创意)
  - [🐛 报告错误](#-报告错误)
  - [✨ 建议改进](#-建议改进)
  - [📖 更新/改进文档](#-更新改进文档)
    - [本地运行文档服务器](#本地运行文档服务器)
      - [方法1：NPM脚本](#方法1-npm脚本)
      - [方法2：VS Code任务](#方法2-vs-code任务)
  - [🧑‍💻 贡献代码](#-贡献代码)
    - [环境设置](#环境设置)
      - [先决条件](#先决条件)
      - [Fork Continue 仓库并包含所有分支](#fork-continue-仓库并包含所有分支)
      - [VS Code](#vs-code)
        - [调试](#调试)
      - [JetBrains](#jetbrains)
        - [调试](#调试-1)
    - [格式化](#格式化)
    - [编写斜杠命令](#编写斜杠命令)
    - [编写上下文提供者](#编写上下文提供者)
    - [添加LLM提供者](#添加llm提供者)
    - [添加模型](#添加模型)
    - [添加预索引文档](#添加预索引文档)
  - [📐 Continue架构](#-continue架构)
    - [Continue VS Code扩展](#continue-vs-code扩展)
    - [Continue JetBrains扩展](#continue-jetbrains扩展)

# ❤️ 贡献方式

## 👋 贡献创意

[这个GitHub项目板](https://github.com/orgs/continuedev/projects/2)列出了您可以为Continue做出贡献的想法。如果您是项目的新手，这些是一个很好的起点。

## 🐛 报告错误

如果您发现了错误，请[创建一个问题](https://github.com/continuedev/continue/issues)来报告！一个好的错误报告包括：

- 错误描述
- 重现步骤
- 您期望发生的事情
- 实际发生的事情
- 截图或视频

## ✨ 建议改进

Continue正在快速添加功能，我们希望听到哪些功能对您最重要。建议改进的最佳方式是：

- 创建一个问题

  - 首先，检查是否已有类似的提案
  - 如果没有，[创建一个问题](https://github.com/continuedev/continue/issues)
  - 请尽可能详细地描述改进内容及其有用之处

- 加入[Continue Discord](https://discord.gg/NWtdYexhMs)并在`#feedback`频道告诉我们您的想法

## 📖 更新/改进文档

Continue在不断改进，但一个功能在文档中反映出来才算完整！如果您发现过时或缺失的内容，可以通过点击[docs.continue.dev](https://docs.continue.dev)页面底部的“编辑此页面”来帮助我们。

### 本地运行文档服务器

您可以使用以下任一方法本地运行文档服务器：

#### 方法1：NPM脚本

1. 打开终端并导航到项目的`docs`子目录。您会看到`docusaurus.config.js`文件，这表明您在正确的位置。

2. 运行以下命令以安装文档服务器所需的依赖项：

   ```bash
   npm install
   ```

3. 运行以下命令以启动文档服务器：

   ```bash
   npm run start
   ```

#### 方法2：VS Code任务

1. 在项目的根目录中打开VS Code。

2. 打开VS Code命令面板（`cmd/ctrl+shift+p`）并选择`Tasks: Run Task`。

3. 查找`docs:start`任务并选择它。

这将启动一个本地服务器，您可以在默认浏览器中查看文档，通常可以通过`http://localhost:3000`访问。

## 🧑‍💻 贡献代码

> 请将PR提交到`dev`分支。我们使用此分支首先在扩展的预发布版本中测试更改。

### 环境设置

#### 先决条件

您应安装Node.js版本20.11.0（LTS）或更高版本。您可以在[nodejs.org](https://nodejs.org/en/download)上获取它，或者如果您使用NVM（Node版本管理器），可以通过在项目根目录中运行以下命令来设置此项目的正确Node.js版本：

```bash
nvm use
```

#### Fork Continue 仓库并包含所有分支

1. 转到[Continue GitHub仓库](https://github.com/continuedev/continue)并将其Fork到您的GitHub帐户。**确保Fork中包含所有分支**。

2. 将您Fork的仓库克隆到本地计算机。使用：`git clone https://github.com/YOUR_USERNAME/continue.git`

3. 导航到克隆的目录并切换到**dev**分支。执行：`git checkout dev`，然后从那里创建您的功能/修复分支，如下所示：`git checkout -b 123-my-feature-branch`

4. 准备好提交更改时，将您的pull request发送到**dev**分支。

#### VS Code

1. 打开VS Code命令面板（`cmd/ctrl+shift+p`）并选择`Tasks: Run Task`，然后选择`install-all-dependencies`

2. 开始调试：

   1. 切换到运行和调试视图
   2. 从下拉菜单中选择`Launch extension`
   3. 点击播放按钮
   4. 这将以调试模式启动扩展并打开一个新的VS Code窗口，其中安装了该扩展
      1. 新的VS Code窗口称为_主机VS Code_
      2. 您开始调试的窗口称为_主VS Code_

3. 要打包扩展，请在`extensions/vscode`目录中运行`npm run package`。这将在`extensions/vscode/build/continue-{VERSION}.vsix`中生成一个文件，您可以通过右键单击并选择“安装扩展VSIX”来安装它。

##### 调试

**断点**可以在调试时用于`core`和`extensions/vscode`文件夹中，但目前不支持在`gui`代码中使用。

**热重载**通过Vite启用，因此如果您对`gui`进行任何更改，它们应自动反映而无需重建。在某些情况下，您可能需要刷新_主机VS Code_窗口以查看更改。

同样，对`core`或`extensions/vscode`的任何更改都可以通过仅重新加载_主机VS Code_窗口来自动包含，使用cmd/ctrl+shift+p "Reload Window"。

#### JetBrains

先决条件：您应使用Intellij IDE，可以在[这里](https://www.jetbrains.com/idea/download)下载。无论是Ultimate还是Community（免费）版本都可以。Continue使用JDK版本17构建，如`extensions/intellij/build.gradle.kts`中所指定。您还应确保已安装Gradle插件。

1. 克隆仓库
2. 在Windows上运行`scripts/install-dependencies.sh`或`scripts/install-dependencies.ps1`。这将安装并构建所有必要的依赖项。
3. 要测试插件，选择“Run Plugin”Gradle配置并点击“Run”或“Debug”按钮，如下图所示：
   ![img](./media/IntelliJRunPluginScreenshot.png)
4. 要打包扩展，请从`extensions/intellij`目录运行`./gradlew build`（或在Windows上运行`./gradlew.bat build`）。这将在`extensions/intellij/build/distributions`中生成一个.zip文件，版本定义在`extensions/intellij/gradle.properties`中。
5. 如果您进行了更改，可能需要在运行“Build Plugin”配置之前重新构建

   a. 如果您更改了`core`或`binary`目录中的代码，请确保从`binary`目录运行`npm run build`以创建新的二进制文件。

   b. 如果您更改了`gui`目录中的代码，请确保从`gui`目录运行`npm run build`以创建新的捆绑包。

   c. 对`extensions/intellij`目录中用Kotlin编写的代码的任何更改将在运行“Build Plugin”时自动包含

##### 调试

Continue的JetBrains扩展通过在`core`目录中利用共享代码并在`binary`目录中打包它来与VS Code扩展共享大部分代码。JetBrains扩展（用Kotlin编写）然后能够通过stdin/stdout在[CoreMessenger.kt](./extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/continue/CoreMessenger.kt)文件中进行通信。

为了快速开发，还可以配置此通信通过本地TCP套接字进行：

1. 在[CoreMessenger.kt](./extensions/intellij/src/main/kotlin/com/github/continuedev/continueintellijextension/continue/CoreMessenger.kt)中，将`useTcp`变量更改为`true`。
2. 打开一个VS Code窗口（我们推荐这样做以获得预配置的Typescript调试体验），并选择“Core Binary”调试配置并按播放。
3. 运行“Run Plugin”Gradle配置。
4. 您现在可以在VS Code中的任何TypeScript文件中设置断点。如果您对代码进行了更改，请重新启动“Core Binary”调试配置并重新加载_主机IntelliJ_窗口。

如果您对Kotlin代码进行了更改，它们通常可以通过“Run -> Debugging Actions -> Reload Changed Classes”进行热重载。

### 我们的Git工作流程

我们保留两个永久分支：`main`和`dev`。所有贡献应作为pull request提交到`dev`分支。当我们准备创建“预发布”版本时，我们在`dev`分支上创建一个标签，这会自动触发[preview.yaml](./.github/workflows/preview.yaml)中的工作流，构建并发布VS Code扩展的一个版本。当一个版本经过充分测试后，我们将其标签合并到`main`分支。在`main`分支上创建标签将触发[main.yaml](./.github/workflows/main.yaml)中的类似工作流，构建并发布VS Code扩展的主版本。任何热修复可以通过从相关版本的标签创建功能分支来进行。

### 格式化

Continue使用[Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)来格式化JavaScript/TypeScript。请在VS Code中安装Prettier扩展并在设置中启用“保存时格式化”。

### 编写斜杠命令

斜杠命令接口在[core/index.d.ts](./core/index.d.ts)中定义，要求您定义一个`name`（用于调用命令的文本）、一个`description`（在斜杠命令菜单中显示的文本）和一个在调用命令时将被调用的`run`函数。`run`函数是一个异步生成器，生成要在聊天中显示的内容。`run`函数传递一个`ContinueSDK`对象，可用于与IDE交互、调用LLM和查看聊天历史记录，以及其他一些实用程序。

```ts
export interface SlashCommand {
  name: string;
  description: string;
  params?: { [key: string]: any };
  run: (sdk: ContinueSDK) => AsyncGenerator<string | undefined>;
}
```

在[core/commands/slash](./core/commands/slash)中有许多斜杠命令示例，我们建议从中借鉴。一旦您在此文件夹中创建了新的`SlashCommand`，还请确保完成以下操作：

- 将您的命令添加到[core/commands/slash/index.ts](./core/commands/slash/index.ts)中的数组中
- 将您的命令添加到[`config_schema.json`](./extensions/vscode/config_schema.json)中的列表中。这确保了Intellisense在用户编辑`config.json`时显示可用命令。如果您的命令接受任何参数，您还应遵循现有示例将它们添加到JSON Schema中。

### 编写上下文提供者

`ContextProvider`是一个Continue插件，允许用户键入'@'以快速选择文档作为语言模型的上下文。`IContextProvider`接口在[`core/index.d.ts`](./core/index.d.ts)中定义，但所有内置上下文提供者都扩展了[`BaseContextProvider`](./core/context/index.ts)。

在定义您的上下文提供者之前，确定您要创建的“类型”。`"query"`类型在选择时会显示一个小的文本输入，允许用户输入类似于[`GoogleContextProvider`](./core/context/providers/GoogleContextProvider.ts)的Google搜索查询。`"submenu"`类型将打开一个可以搜索和选择的项目子菜单。示例包括[`GitHubIssuesContextProvider`](./core/context/providers/GitHubIssuesContextProvider.ts)和[`DocsContextProvider`](./core/context/providers/DocsContextProvider.ts)。`"normal"`类型将立即添加上下文项。示例包括[`DiffContextProvider`](./core/context/providers/DiffContextProvider.ts)和[`OpenFilesContextProvider`](./core/context/providers/OpenFilesContextProvider.ts)。

在编写上下文提供者后，请确保完成以下操作：

- 将其添加到[core/context/providers/index.ts](./core/context/providers/index.ts)中的上下文提供者数组中
- 将其添加到[core/index.d.ts](./core/index.d.ts)中的`ContextProviderName`类型中
- 将其添加到[`config_schema.json`](./extensions/vscode/config_schema.json)中的列表中。如果您的上下文提供者接受任何参数，您还应遵循现有示例将它们添加到JSON Schema中。

### 添加LLM提供者

Continue支持十多个不同的LLM“提供者”，使得使用OpenAI、Ollama、Together、LM Studio、Msty等运行的模型变得容易。您可以在[这里](https://github.com/continuedev/continue/tree/main/core/llm/llms)找到所有现有的提供者，如果您发现缺少的，可以通过以下步骤添加：

1. 在`core/llm/llms`目录中创建一个新文件。文件名应为提供者的名称，并应导出一个扩展`BaseLLM`的类。此类应包含以下最小实现。我们建议查看现有的提供者以获取更多详细信息。[LlamaCpp Provider](./core/llm/llms/LlamaCpp.ts)是一个很好的简单示例。

- `providerName` - 您的提供者的标识符
- 至少一个`_streamComplete`或`_streamChat` - 这是向API发出请求并返回流响应的函数。您只需实现一个，因为Continue可以在“聊天”和“原始完成”之间自动转换。

2. 将您的提供者添加到[core/llm/llms/index.ts](./core/llm/llms/index.ts)中的`LLMs`数组中。
3. 如果您的提供者支持图像，请将其添加到[core/llm/autodetect.ts](./core/llm/autodetect.ts)中的`PROVIDER_SUPPORTS_IMAGES`数组中。
4. 将必要的JSON Schema类型添加到[`config_schema.json`](./extensions/vscode/config_schema.json)中。这确保了Intellisense在用户编辑`config.json`时显示可用选项。
5. 在[`docs/docs/customize/model-providers`](./docs/docs/customize/model-providers)中为您的提供者添加文档页面。这应显示在`config.json`中配置您的提供者的示例，并解释可用的选项。

### 添加模型

虽然任何与支持的提供者一起工作的模型都可以与Continue一起使用，但我们保留了一份推荐模型列表，可以从UI或`config.json`中自动配置。添加模型时应更新以下文件：

- [config_schema.json](./extensions/vscode/config_schema.json) - 这是用于验证`config.json`的JSON Schema定义。您会注意到在“definitions.ModelDescription.allOf”中定义了许多规则。这里是您编写规则的地方，可以指定“对于提供者'anthropic'，仅允许模型'claude-2'和'claude-instant-1'。查看所有这些规则并确保您的模型包含在支持它的提供者中。
- [modelData.ts](./gui/src/util/modelData.ts) - 此文件定义在侧边栏的模型选择UI中显示的信息。要添加新模型：
  1. 创建一个`ModelPackage`对象，遵循文件顶部附近的许多示例
  2. 如果您希望它显示在“模型”选项卡中，请将`ModelPackage`添加到`MODEL_INFO`数组中
  3. 如果您希望它显示在任何提供者下，请转到`PROVIDER_INFO`对象并将其添加到每个您希望它显示的提供者的`packages`数组中。如果它是一个OS模型，应该对大多数提供OS模型的提供者有效，您可能只需将其添加到`osModels`数组中作为简写。
- [index.d.ts](./core/index.d.ts) - 此文件定义了Continue中使用的TypeScript类型。您会发现一个`ModelName`类型。确保将您的模型名称添加到此处。
- LLM提供者：由于许多提供者使用自己的自定义字符串来标识模型，您必须为每个这些提供者添加从Continue的模型名称（您添加到`index.d.ts`的名称）到模型字符串的翻译：[Ollama](./core/llm/llms/Ollama.ts)、[Together](./core/llm/llms/Together.ts)和[Replicate](./core/llm/llms/Replicate.ts)。您可以在这里找到它们的完整模型列表：[Ollama](https://ollama.ai/library)、[Together](https://docs.together.ai/docs/inference-models)、[Replicate](https://replicate.com/collections/streaming-language-models)。
- [Prompt Templates](./core/llm/index.ts) - 在此文件中，您会发现`autodetectTemplateType`函数。确保对于您刚刚添加的模型名称，此函数返回正确的模板类型。这是假设该模型的聊天模板已在Continue中内置。如果没有，您将不得不添加模板类型和相应的编辑和聊天模板。

### 添加预索引文档

Continue的@docs上下文提供者允许您轻松引用整个文档站点，然后使用嵌入将最相关的页面添加到上下文中。为了使体验尽可能顺畅，我们预先索引了许多最受欢迎的文档站点。如果您想将新文档添加到此列表中，只需将一个对象添加到[preIndexedDocs.ts](./core/indexing/docs/preIndexedDocs.ts)中的列表中。`startUrl`是爬虫将开始的地方，`rootUrl`将过滤掉不在该站点上且不在`rootUrl`路径下的任何页面。

## 📐 Continue架构

Continue由两个部分组成，这两个部分被分开以便于在其他IDE中扩展：

1. **Continue GUI** - Continue GUI是一个React应用程序，允许用户控制Continue。它显示当前的聊天历史记录，允许用户提问、调用斜杠命令和使用上下文提供者。GUI还处理大部分状态并尽可能多地持有逻辑，以便在IDE之间重用。

2. **Continue扩展** - Continue扩展是一个IDE插件，实现了[IDE接口](./core/index.d.ts#L229)。这允许GUI请求信息或在IDE中执行操作。无论IDE如何，都会使用相同的接口。我们构建的第一个Continue扩展是VS Code和JetBrains，但我们计划在未来为其他IDE构建客户端。IDE客户端必须1.实现IDE接口，如[这里](./extensions/vscode/src/ideProtocol.ts)为VS Code所做的那样，并且2.在侧边栏中显示Continue GUI，如[这里](./extensions/vscode/src/ContinueGUIWebviewViewProvider.ts)所示。

### Continue VS Code扩展

VS Code扩展的起点是[activate.ts](./extensions/vscode/src/activation/activate.ts)。`activateExtension`函数将在IDE的侧边栏中注册所有命令并加载Continue GUI作为webview。

### Continue JetBrains扩展

JetBrains扩展目前处于alpha测试阶段。如果您有兴趣参与其开发，请在[Discord](https://discord.gg/vapESyrFmJ)上联系我们。
