import { IContextProvider } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger } from "core/util/messenger";
import { getConfigJsonPath, getConfigTsPath } from "core/util/paths";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { ContinueCompletionProvider } from "../autocomplete/completionProvider";
import {
  monitorBatteryChanges,
  setupStatusBar,
  StatusBarStatus,
} from "../autocomplete/statusBar";
import { registerAllCommands } from "../commands";
import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { DiffManager } from "../diff/horizontal";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { QuickEdit } from "../quickEdit/QuickEditQuickPick";
import { setupRemoteConfigSync } from "../stubs/activation";
import {
  getControlPlaneSessionInfo,
  WorkOsAuthProvider,
} from "../stubs/WorkOsAuthProvider";
import { arePathsEqual } from "../util/arePathsEqual";
import { Battery } from "../util/battery";
import { AUTH_TYPE, EXTENSION_NAME } from "../util/constants";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { VsCodeIde } from "../VsCodeIde";
import type { VsCodeWebviewProtocol } from "../webviewProtocol";
import { VsCodeMessenger } from "./VsCodeMessenger";

export class VsCodeExtension {
  // 目前这些是公开的，以便在测试中使用（test/test-suites）

  private configHandler: ConfigHandler;
  private extensionContext: vscode.ExtensionContext;
  private ide: VsCodeIde;
  private tabAutocompleteModel: TabAutocompleteModel;
  private sidebar: ContinueGUIWebviewViewProvider;
  private windowId: string;
  private diffManager: DiffManager;
  private verticalDiffManager: VerticalDiffManager;
  webviewProtocolPromise: Promise<VsCodeWebviewProtocol>;
  private core: Core;
  private battery: Battery;
  private workOsAuthProvider: WorkOsAuthProvider;

  constructor(context: vscode.ExtensionContext) {
    // 注册认证提供者
    this.workOsAuthProvider = new WorkOsAuthProvider(context);
    this.workOsAuthProvider.refreshSessions();
    context.subscriptions.push(this.workOsAuthProvider);

    let resolveWebviewProtocol: any = undefined;
    this.webviewProtocolPromise = new Promise<VsCodeWebviewProtocol>(
      (resolve) => {
        resolveWebviewProtocol = resolve;
      },
    );
    this.diffManager = new DiffManager(context);
    this.ide = new VsCodeIde(this.diffManager, this.webviewProtocolPromise);
    this.extensionContext = context;
    this.windowId = uuidv4();

    // core的依赖
    let resolveVerticalDiffManager: any = undefined;
    const verticalDiffManagerPromise = new Promise<VerticalDiffManager>(
      (resolve) => {
        resolveVerticalDiffManager = resolve;
      },
    );
    let resolveConfigHandler: any = undefined;
    const configHandlerPromise = new Promise<ConfigHandler>((resolve) => {
      resolveConfigHandler = resolve;
    });
    this.sidebar = new ContinueGUIWebviewViewProvider(
      configHandlerPromise,
      this.windowId,
      this.extensionContext,
    );

    // 侧边栏
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "continue.continueGUIView",
        this.sidebar,
        {
          webviewOptions: { retainContextWhenHidden: true },
        },
      ),
    );
    resolveWebviewProtocol(this.sidebar.webviewProtocol);

    // 带输出通道的Config Handler
    const outputChannel = vscode.window.createOutputChannel(
      "Continue - LLM Prompt/Completion",
    );
    const inProcessMessenger = new InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >();

    new VsCodeMessenger(
      inProcessMessenger,
      this.sidebar.webviewProtocol,
      this.ide,
      verticalDiffManagerPromise,
      configHandlerPromise,
      this.workOsAuthProvider,
    );

    this.core = new Core(inProcessMessenger, this.ide, async (log: string) => {
      outputChannel.appendLine(
        "==========================================================================",
      );
      outputChannel.appendLine(
        "==========================================================================",
      );
      outputChannel.append(log);
    });
    this.configHandler = this.core.configHandler;
    resolveConfigHandler?.(this.configHandler);

    this.configHandler.reloadConfig();
    this.verticalDiffManager = new VerticalDiffManager(
      this.configHandler,
      this.sidebar.webviewProtocol,
    );
    resolveVerticalDiffManager?.(this.verticalDiffManager);
    this.tabAutocompleteModel = new TabAutocompleteModel(this.configHandler);

    setupRemoteConfigSync(
      this.configHandler.reloadConfig.bind(this.configHandler),
    );

    // 索引 + 暂停令牌
    this.diffManager.webviewProtocol = this.sidebar.webviewProtocol;

    this.configHandler.loadConfig().then((config) => {
      const { verticalDiffCodeLens } = registerAllCodeLensProviders(
        context,
        this.diffManager,
        this.verticalDiffManager.filepathToCodeLens,
        config,
      );

      this.verticalDiffManager.refreshCodeLens =
        verticalDiffCodeLens.refresh.bind(verticalDiffCodeLens);
    });

    this.configHandler.onConfigUpdate((newConfig) => {
      this.sidebar.webviewProtocol?.request("configUpdate", undefined);

      this.tabAutocompleteModel.clearLlm();

      registerAllCodeLensProviders(
        context,
        this.diffManager,
        this.verticalDiffManager.filepathToCodeLens,
        newConfig,
      );
    });

    // Tab自动补全
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const enabled = config.get<boolean>("enableTabAutocomplete");

    // 注册内联补全提供者
    setupStatusBar(
      enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
    );
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        new ContinueCompletionProvider(
          this.configHandler,
          this.ide,
          this.tabAutocompleteModel,
          this.sidebar.webviewProtocol,
        ),
      ),
    );

    // 电池
    this.battery = new Battery();
    context.subscriptions.push(this.battery);
    context.subscriptions.push(monitorBatteryChanges(this.battery));

    const quickEdit = new QuickEdit(
      this.verticalDiffManager,
      this.configHandler,
      this.sidebar.webviewProtocol,
      this.ide,
      context,
    );

    // 命令
    registerAllCommands(
      context,
      this.ide,
      context,
      this.sidebar,
      this.configHandler,
      this.diffManager,
      this.verticalDiffManager,
      this.core.continueServerClientPromise,
      this.battery,
      quickEdit,
      this.core,
    );

    // 由于性能问题已禁用
    // registerDebugTracker(this.sidebar.webviewProtocol, this.ide);

    // 监听文件保存 - 使用全局文件监视器以便捕获窗口外的更改
    fs.watchFile(getConfigJsonPath(), { interval: 1000 }, async (stats) => {
      await this.configHandler.reloadConfig();
    });

    fs.watchFile(getConfigTsPath(), { interval: 1000 }, (stats) => {
      this.configHandler.reloadConfig();
    });

    vscode.workspace.onDidSaveTextDocument(async (event) => {
      // 监听工作区中的文件更改
      const filepath = event.uri.fsPath;

      if (arePathsEqual(filepath, getConfigJsonPath())) {
        // 触发一个toast通知以提供配置已更新的UI反馈
        const showToast = context.globalState.get<boolean>(
          "showConfigUpdateToast",
          true,
        );

        if (showToast) {
          vscode.window
            .showInformationMessage("配置已更新", "不再显示")
            .then((selection) => {
              if (selection === "不再显示") {
                context.globalState.update("showConfigUpdateToast", false);
              }
            });
        }
      }

      if (
        filepath.endsWith(".continuerc.json") ||
        filepath.endsWith(".prompt")
      ) {
        this.configHandler.reloadConfig();
      } else if (
        filepath.endsWith(".continueignore") ||
        filepath.endsWith(".gitignore")
      ) {
        // 重新索引工作区
        this.core.invoke("index/forceReIndex", undefined);
      } else {
        // 重新索引文件
        const indexer = await this.core.codebaseIndexerPromise;
        indexer.refreshFile(filepath);
      }
    });

    // 当GitHub登录状态更改时，重新加载配置
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === "github") {
        this.configHandler.reloadConfig();
      } else if (e.provider.id === AUTH_TYPE) {
        const sessionInfo = await getControlPlaneSessionInfo(true);
        this.webviewProtocolPromise.then(async (webviewProtocol) => {
          webviewProtocol.request("didChangeControlPlaneSessionInfo", {
            sessionInfo,
          });

          // 确保continue-proxy模型和任何其他需要它的东西获得更新的访问令牌
          this.configHandler.reloadConfig();
        });
        this.core.invoke("didChangeControlPlaneSessionInfo", { sessionInfo });
      }
    });

    // 当分支更改时刷新索引
    this.ide.getWorkspaceDirs().then((dirs) =>
      dirs.forEach(async (dir) => {
        const repo = await this.ide.getRepo(vscode.Uri.file(dir));
        if (repo) {
          repo.state.onDidChange(() => {
            // 传递给此回调的参数始终为undefined，因此跟踪以前的分支
            const currentBranch = repo?.state?.HEAD?.name;
            if (currentBranch) {
              if (this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir]) {
                if (
                  currentBranch !== this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir]
                ) {
                  // 仅在此目录中触发索引刷新
                  this.core.invoke("index/forceReIndex", { dir });
                }
              }

              this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir] = currentBranch;
            }
          });
        }
      }),
    );

    // 为只读虚拟文档注册内容提供者
    const documentContentProvider = new (class
      implements vscode.TextDocumentContentProvider
    {
      // 发射器及其事件
      onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
      onDidChange = this.onDidChangeEmitter.event;

      provideTextDocumentContent(uri: vscode.Uri): string {
        return uri.query;
      }
    })();
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VsCodeExtension.continueVirtualDocumentScheme,
        documentContentProvider,
      ),
    );

    this.ide.onDidChangeActiveTextEditor((filepath) => {
      this.core.invoke("didChangeActiveTextEditor", { filepath });
    });
  }

  static continueVirtualDocumentScheme = EXTENSION_NAME;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private PREVIOUS_BRANCH_FOR_WORKSPACE_DIR: { [dir: string]: string } = {};

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.configHandler.registerCustomContextProvider(contextProvider);
  }
}