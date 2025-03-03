import { ConfigHandler } from "core/config/ConfigHandler";
import { getModelByRole } from "core/config/util";
import { applyCodeBlock } from "core/edit/lazy/applyCodeBlock";
import {
  FromCoreProtocol,
  FromWebviewProtocol,
  ToCoreProtocol,
} from "core/protocol";
import { ToWebviewFromCoreProtocol } from "core/protocol/coreWebview";
import { ToIdeFromWebviewOrCoreProtocol } from "core/protocol/ide";
import { ToIdeFromCoreProtocol } from "core/protocol/ideCore";
import {
  CORE_TO_WEBVIEW_PASS_THROUGH,
  WEBVIEW_TO_CORE_PASS_THROUGH,
} from "core/protocol/passThrough";
import { getBasename } from "core/util";
import { InProcessMessenger, Message } from "core/util/messenger";
import { getConfigJsonPath } from "core/util/paths";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { VerticalDiffManager } from "../diff/vertical/manager";
import {
  getControlPlaneSessionInfo,
  WorkOsAuthProvider,
} from "../stubs/WorkOsAuthProvider";
import { getExtensionUri } from "../util/vscode";
import { VsCodeIde } from "../VsCodeIde";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

/**
 * Core和Webview之间的共享消息类
 * 这样我们就不必重写一些处理程序
 */
type TODO = any;
type ToIdeOrWebviewFromCoreProtocol = ToIdeFromCoreProtocol &
  ToWebviewFromCoreProtocol;
export class VsCodeMessenger {
  onWebview<T extends keyof FromWebviewProtocol>(
    messageType: T,
    handler: (
      message: Message<FromWebviewProtocol[T][0]>,
    ) => Promise<FromWebviewProtocol[T][1]> | FromWebviewProtocol[T][1],
  ): void {
    this.webviewProtocol.on(messageType, handler);
  }

  onCore<T extends keyof ToIdeOrWebviewFromCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeOrWebviewFromCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeOrWebviewFromCoreProtocol[T][1]>
      | ToIdeOrWebviewFromCoreProtocol[T][1],
  ): void {
    this.inProcessMessenger.externalOn(messageType, handler);
  }

  onWebviewOrCore<T extends keyof ToIdeFromWebviewOrCoreProtocol>(
    messageType: T,
    handler: (
      message: Message<ToIdeFromWebviewOrCoreProtocol[T][0]>,
    ) =>
      | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
      | ToIdeFromWebviewOrCoreProtocol[T][1],
  ): void {
    this.onWebview(messageType, handler);
    this.onCore(messageType, handler);
  }

  constructor(
    private readonly inProcessMessenger: InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
    private readonly ide: VsCodeIde,
    private readonly verticalDiffManagerPromise: Promise<VerticalDiffManager>,
    private readonly configHandlerPromise: Promise<ConfigHandler>,
    private readonly workOsAuthProvider: WorkOsAuthProvider,
  ) {
    /** 仅WEBVIEW监听器 **/
    this.onWebview("showFile", (msg) => {
      this.ide.openFile(msg.data.filepath);
    });

    this.onWebview("vscode/openMoveRightMarkdown", (msg) => {
      vscode.commands.executeCommand(
        "markdown.showPreview",
        vscode.Uri.file(
          path.join(
            getExtensionUri().fsPath,
            "media",
            "move-chat-panel-right.md",
          ),
        ),
      );
    });

    this.onWebview("openConfigJson", (msg) => {
      this.ide.openFile(getConfigJsonPath());
    });

    this.onWebview("readRangeInFile", async (msg) => {
      return await vscode.workspace
        .openTextDocument(msg.data.filepath)
        .then((document) => {
          const start = new vscode.Position(0, 0);
          const end = new vscode.Position(5, 0);
          const range = new vscode.Range(start, end);

          const contents = document.getText(range);
          return contents;
        });
    });
    this.onWebview("toggleDevTools", (msg) => {
      vscode.commands.executeCommand("workbench.action.toggleDevTools");
      vscode.commands.executeCommand("continue.viewLogs");
    });
    this.onWebview("reloadWindow", (msg) => {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    });
    this.onWebview("focusEditor", (msg) => {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });
    this.onWebview("toggleFullScreen", (msg) => {
      vscode.commands.executeCommand("continue.toggleFullScreen");
    });
    // 历史记录
    this.onWebview("saveFile", async (msg) => {
      return await ide.saveFile(msg.data.filepath);
    });
    this.onWebview("readFile", async (msg) => {
      return await ide.readFile(msg.data.filepath);
    });
    this.onWebview("showDiff", async (msg) => {
      return await ide.showDiff(
        msg.data.filepath,
        msg.data.newContents,
        msg.data.stepIndex,
      );
    });

    webviewProtocol.on("acceptDiff", async ({ data: { filepath } }) => {
      await vscode.commands.executeCommand("continue.acceptDiff", filepath);
    });

    webviewProtocol.on("rejectDiff", async ({ data: { filepath } }) => {
      await vscode.commands.executeCommand("continue.rejectDiff", filepath);
    });

    this.onWebview("applyToCurrentFile", async (msg) => {
      // 获取活动文本编辑器
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("没有活动编辑器可应用编辑");
        return;
      }

      // 从配置中获取LLM
      const configHandler = await configHandlerPromise;
      const config = await configHandler.loadConfig();

      let llm = getModelByRole(config, "applyCodeBlock");

      if (!llm) {
        const defaultModelTitle = await this.webviewProtocol.request(
          "getDefaultModelTitle",
          undefined,
        );

        llm = config.models.find((model) => model.title === defaultModelTitle);

        if (!llm) {
          vscode.window.showErrorMessage(
            `在配置中找不到模型 ${defaultModelTitle}。`,
          );
          return;
        }
      }

      const fastLlm = getModelByRole(config, "repoMapFileSelection") ?? llm;

      // 生成差异并通过差异管理器
      const [instant, diffLines] = await applyCodeBlock(
        editor.document.getText(),
        msg.data.text,
        getBasename(editor.document.fileName),
        llm,
        fastLlm,
      );
      const verticalDiffManager = await this.verticalDiffManagerPromise;
      if (instant) {
        verticalDiffManager.streamDiffLines(
          diffLines,
          instant,
          msg.data.streamId,
        );
      } else {
        const prompt = `以下代码被建议作为编辑：\n\`\`\`\n${msg.data.text}\n\`\`\`\n请将其应用于之前的代码。`;
        const fullEditorRange = new vscode.Range(
          0,
          0,
          editor.document.lineCount - 1,
          editor.document.lineAt(editor.document.lineCount - 1).text.length,
        );
        const rangeToApplyTo = editor.selection.isEmpty
          ? fullEditorRange
          : editor.selection;
        verticalDiffManager.streamEdit(
          prompt,
          llm.title,
          msg.data.streamId,
          undefined,
          undefined,
          rangeToApplyTo,
        );
      }
    });

    this.onWebview("showTutorial", async (msg) => {
      const tutorialPath = path.join(
        getExtensionUri().fsPath,
        "continue_tutorial.py",
      );
      // 确保键盘快捷键与操作系统匹配
      if (process.platform !== "darwin") {
        let tutorialContent = fs.readFileSync(tutorialPath, "utf8");
        tutorialContent = tutorialContent
          .replace("⌘", "^")
          .replace("Cmd", "Ctrl");
        fs.writeFileSync(tutorialPath, tutorialContent);
      }

      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.file(tutorialPath),
      );
      await vscode.window.showTextDocument(doc, {
        preview: false,
      });
    });

    this.onWebview("openUrl", (msg) => {
      vscode.env.openExternal(vscode.Uri.parse(msg.data));
    });
    this.onWebview("insertAtCursor", async (msg) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || !editor.selection) {
        return;
      }

      editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(editor.selection.start, editor.selection.end),
          msg.data.text,
        );
      });
    });

    /** 从WEBVIEW到CORE的传递和返回 **/
    WEBVIEW_TO_CORE_PASS_THROUGH.forEach((messageType) => {
      this.onWebview(messageType, async (msg) => {
        return (await this.inProcessMessenger.externalRequest(
          messageType,
          msg.data,
          msg.messageId,
        )) as TODO;
      });
    });

    /** 从CORE到WEBVIEW的传递和返回 **/
    CORE_TO_WEBVIEW_PASS_THROUGH.forEach((messageType) => {
      this.onCore(messageType, async (msg) => {
        return this.webviewProtocol.request(messageType, msg.data);
      });
    });

    /** 仅CORE监听器 **/
    // 目前没有

    /** CORE和WEBVIEW **/
    this.onWebviewOrCore("getIdeSettings", async (msg) => {
      return ide.getIdeSettings();
    });
    this.onWebviewOrCore("getDiff", async (msg) => {
      return ide.getDiff();
    });
    this.onWebviewOrCore("getTerminalContents", async (msg) => {
      return ide.getTerminalContents();
    });
    this.onWebviewOrCore("getDebugLocals", async (msg) => {
      return ide.getDebugLocals(Number(msg.data.threadIndex));
    });
    this.onWebviewOrCore("getAvailableThreads", async (msg) => {
      return ide.getAvailableThreads();
    });
    this.onWebviewOrCore("getTopLevelCallStackSources", async (msg) => {
      return ide.getTopLevelCallStackSources(
        msg.data.threadIndex,
        msg.data.stackDepth,
      );
    });
    this.onWebviewOrCore("getWorkspaceDirs", async (msg) => {
      return ide.getWorkspaceDirs();
    });
    this.onWebviewOrCore("listFolders", async (msg) => {
      return ide.listFolders();
    });
    this.onWebviewOrCore("writeFile", async (msg) => {
      return ide.writeFile(msg.data.path, msg.data.contents);
    });
    this.onWebviewOrCore("showVirtualFile", async (msg) => {
      return ide.showVirtualFile(msg.data.name, msg.data.content);
    });
    this.onWebviewOrCore("getContinueDir", async (msg) => {
      return ide.getContinueDir();
    });
    this.onWebviewOrCore("openFile", async (msg) => {
      return ide.openFile(msg.data.path);
    });
    this.onWebviewOrCore("runCommand", async (msg) => {
      await ide.runCommand(msg.data.command);
    });
    this.onWebviewOrCore("getSearchResults", async (msg) => {
      return ide.getSearchResults(msg.data.query);
    });
    this.onWebviewOrCore("subprocess", async (msg) => {
      return ide.subprocess(msg.data.command);
    });
    this.onWebviewOrCore("getProblems", async (msg) => {
      return ide.getProblems(msg.data.filepath);
    });
    this.onWebviewOrCore("getBranch", async (msg) => {
      const { dir } = msg.data;
      return ide.getBranch(dir);
    });
    this.onWebviewOrCore("getOpenFiles", async (msg) => {
      return ide.getOpenFiles();
    });
    this.onWebviewOrCore("getCurrentFile", async () => {
      return ide.getCurrentFile();
    });
    this.onWebviewOrCore("getPinnedFiles", async (msg) => {
      return ide.getPinnedFiles();
    });
    this.onWebviewOrCore("showLines", async (msg) => {
      const { filepath, startLine, endLine } = msg.data;
      return ide.showLines(filepath, startLine, endLine);
    });
    this.onWebviewOrCore("showToast", (msg) => {
      this.ide.showToast(...msg.data);
    });
    this.onWebviewOrCore("getGitHubAuthToken", (msg) =>
      ide.getGitHubAuthToken(msg.data),
    );
    this.onWebviewOrCore("getControlPlaneSessionInfo", async (msg) => {
      return getControlPlaneSessionInfo(msg.data.silent);
    });
    this.onWebviewOrCore("logoutOfControlPlane", async (msg) => {
      const sessions = await this.workOsAuthProvider.getSessions();
      await Promise.all(
        sessions.map((session) => workOsAuthProvider.removeSession(session.id)),
      );
    });
  }
}