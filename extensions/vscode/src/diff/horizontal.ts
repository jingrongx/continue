import { devDataPath } from "core/util/paths";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { getMetaKeyLabel, getPlatform } from "../util/util";
import { uriFromFilePath } from "../util/vscode";
import type { VsCodeWebviewProtocol } from "../webviewProtocol";

interface DiffInfo {
  originalFilepath: string;
  newFilepath: string;
  editor?: vscode.TextEditor;
  step_index: number;
  range: vscode.Range;
}

async function readFile(path: string): Promise<string> {
  return await vscode.workspace.fs
    .readFile(uriFromFilePath(path))
    .then((bytes) => new TextDecoder().decode(bytes));
}

async function writeFile(uri: vscode.Uri, contents: string) {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(contents));
}

// 这是本地的
export const DIFF_DIRECTORY = path
  .join(os.homedir(), ".continue", ".diffs")
  .replace(/^C:/, "c:");

export class DiffManager {
  // 在全局 .continue 目录中创建一个临时文件以显示更新的版本
  // 这样做是因为虚拟文件是只读的
  private diffs: Map<string, DiffInfo> = new Map();

  diffAtNewFilepath(newFilepath: string): DiffInfo | undefined {
    return this.diffs.get(newFilepath);
  }

  private async setupDirectory() {
    // 确保差异目录存在
    if (!fs.existsSync(DIFF_DIRECTORY)) {
      fs.mkdirSync(DIFF_DIRECTORY, {
        recursive: true,
      });
    }
  }

  webviewProtocol: VsCodeWebviewProtocol | undefined;

  constructor(private readonly extensionContext: vscode.ExtensionContext) {
    this.setupDirectory();

    // 监听文件关闭事件，如果是差异文件，则清理
    vscode.workspace.onDidCloseTextDocument((document) => {
      const newFilepath = document.uri.fsPath;
      const diffInfo = this.diffs.get(newFilepath);
      if (diffInfo) {
        this.cleanUpDiff(diffInfo, false);
      }
    });
  }

  private escapeFilepath(filepath: string): string {
    return filepath
      .replace(/\//g, "_f_")
      .replace(/\\/g, "_b_")
      .replace(/:/g, "_c_");
  }

  private remoteTmpDir = "/tmp/continue";
  private getNewFilepath(originalFilepath: string): string {
    if (vscode.env.remoteName) {
      // 如果我们在远程环境中，使用远程的临时目录
      // 这样做是因为没有简单的方法找到主目录，
      // 并且没有对根目录的写权限
      // 将这些写入本地会导致其他问题
      // 因为 vscode.diff 命令总是尝试从远程读取
      vscode.workspace.fs.createDirectory(uriFromFilePath(this.remoteTmpDir));
      return path.join(
        this.remoteTmpDir,
        this.escapeFilepath(originalFilepath),
      );
    }
    return path.join(DIFF_DIRECTORY, this.escapeFilepath(originalFilepath));
  }

  private async openDiffEditor(
    originalFilepath: string,
    newFilepath: string,
  ): Promise<vscode.TextEditor | undefined> {
    // 如果文件尚不存在或基名是单个数字（vscode 终端），则不要打开差异编辑器
    try {
      await vscode.workspace.fs.stat(uriFromFilePath(newFilepath));
    } catch (e) {
      console.log("文件不存在，不打开差异编辑器", e);
      return undefined;
    }
    if (path.basename(originalFilepath).match(/^\d$/)) {
      return undefined;
    }

    const rightUri = uriFromFilePath(newFilepath);
    const leftUri = uriFromFilePath(originalFilepath);
    const title = "Continue Diff";
    vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // 更改 vscode 设置以允许在差异编辑器中使用 codeLens
    vscode.workspace
      .getConfiguration("diffEditor", editor.document.uri)
      .update("codeLens", true, vscode.ConfigurationTarget.Global);

    if (
      this.extensionContext.globalState.get<boolean>(
        "continue.showDiffInfoMessage",
      ) !== false
    ) {
      vscode.window
        .showInformationMessage(
          `在文件顶部接受 (${getMetaKeyLabel()}⇧⏎) 或拒绝 (${getMetaKeyLabel()}⇧⌫)。`,
          "知道了",
          "不再显示",
        )
        .then((selection) => {
          if (selection === "不再显示") {
            // 获取全局状态
            this.extensionContext.globalState.update(
              "continue.showDiffInfoMessage",
              false,
            );
          }
        });
    }

    return editor;
  }

  private _findFirstDifferentLine(contentA: string, contentB: string): number {
    const linesA = contentA.split("\n");
    const linesB = contentB.split("\n");
    for (let i = 0; i < linesA.length && i < linesB.length; i++) {
      if (linesA[i] !== linesB[i]) {
        return i;
      }
    }
    return 0;
  }

  async writeDiff(
    originalFilepath: string,
    newContent: string,
    step_index: number,
  ): Promise<string> {
    await this.setupDirectory();

    // 创建或更新现有差异
    const newFilepath = this.getNewFilepath(originalFilepath);
    await writeFile(uriFromFilePath(newFilepath), newContent);

    // 如果这是一个新的差异，则打开差异编辑器
    if (!this.diffs.has(newFilepath)) {
      // 找出第一个不同的行
      const oldContent = await readFile(originalFilepath);
      const line = this._findFirstDifferentLine(oldContent, newContent);

      const diffInfo: DiffInfo = {
        originalFilepath,
        newFilepath,
        step_index,
        range: new vscode.Range(line, 0, line + 1, 0),
      };
      this.diffs.set(newFilepath, diffInfo);
    }

    // 如果编辑器尚未打开，则打开编辑器
    const diffInfo = this.diffs.get(newFilepath);
    if (diffInfo && !diffInfo?.editor) {
      diffInfo.editor = await this.openDiffEditor(
        originalFilepath,
        newFilepath,
      );
      this.diffs.set(newFilepath, diffInfo);
    }

    if (getPlatform() === "windows") {
      // 只是渲染方式的问题
      // 在 Windows 上没有这个会卡顿
      // 在 Mac 上有这个会闪烁太多
      vscode.commands.executeCommand(
        "workbench.action.files.revert",
        uriFromFilePath(newFilepath),
      );
    }

    return newFilepath;
  }

  cleanUpDiff(diffInfo: DiffInfo, hideEditor = true) {
    // 关闭编辑器，移除记录，删除文件
    if (hideEditor && diffInfo.editor) {
      try {
        vscode.window.showTextDocument(diffInfo.editor.document);
        vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      } catch {}
    }
    this.diffs.delete(diffInfo.newFilepath);
    vscode.workspace.fs.delete(uriFromFilePath(diffInfo.newFilepath));
  }

  private inferNewFilepath() {
    const activeEditorPath =
      vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeEditorPath && path.dirname(activeEditorPath) === DIFF_DIRECTORY) {
      return activeEditorPath;
    }
    const visibleEditors = vscode.window.visibleTextEditors.map(
      (editor) => editor.document.uri.fsPath,
    );
    for (const editorPath of visibleEditors) {
      if (path.dirname(editorPath) === DIFF_DIRECTORY) {
        for (const otherEditorPath of visibleEditors) {
          if (
            path.dirname(otherEditorPath) !== DIFF_DIRECTORY &&
            this.getNewFilepath(otherEditorPath) === editorPath
          ) {
            return editorPath;
          }
        }
      }
    }

    if (this.diffs.size === 1) {
      return Array.from(this.diffs.keys())[0];
    }
    return undefined;
  }

  async acceptDiff(newFilepath?: string) {
    // 当来自键盘快捷键时，我们必须从可见文本编辑器推断 newFilepath
    if (!newFilepath) {
      newFilepath = this.inferNewFilepath();
    }
    if (!newFilepath) {
      console.log("没有提供 newFilepath 来接受差异");
      return;
    }
    // 获取差异信息，将新文件复制到原始文件，然后从记录中删除并关闭相应的编辑器
    const diffInfo = this.diffs.get(newFilepath);
    if (!diffInfo) {
      console.log("没有找到对应的 diffInfo 用于 newFilepath");
      return;
    }

    // 保存右侧文件，然后复制到原始文件
    vscode.workspace.textDocuments
      .find((doc) => doc.uri.fsPath === newFilepath)
      ?.save()
      .then(async () => {
        await writeFile(
          uriFromFilePath(diffInfo.originalFilepath),
          await readFile(diffInfo.newFilepath),
        );
        this.cleanUpDiff(diffInfo);
      });

    await recordAcceptReject(true, diffInfo);
  }

  async rejectDiff(newFilepath?: string) {
    // 如果没有提供 newFilepath 并且字典中只有一个，则使用该文件
    if (!newFilepath) {
      newFilepath = this.inferNewFilepath();
    }
    if (!newFilepath) {
      console.log(
        "没有提供 newFilepath 来拒绝差异，diffs.size 是",
        this.diffs.size,
      );
      return;
    }
    const diffInfo = this.diffs.get(newFilepath);
    if (!diffInfo) {
      console.log("没有找到对应的 diffInfo 用于 newFilepath");
      return;
    }

    // 停止在 step_index 的步骤，以防它仍在流式传输
    this.webviewProtocol?.request("setInactive", undefined);

    vscode.workspace.textDocuments
      .find((doc) => doc.uri.fsPath === newFilepath)
      ?.save()
      .then(() => {
        this.cleanUpDiff(diffInfo);
      });

    await recordAcceptReject(false, diffInfo);
  }
}

async function recordAcceptReject(accepted: boolean, diffInfo: DiffInfo) {
  const devDataDir = devDataPath();
  const suggestionsPath = path.join(devDataDir, "suggestions.json");

  // 初始化建议列表
  let suggestions = [];

  // 检查 suggestions.json 是否存在
  try {
    const rawData = await readFile(suggestionsPath);
    suggestions = JSON.parse(rawData);
  } catch {}

  // 将新建议添加到列表中
  suggestions.push({
    accepted,
    timestamp: Date.now(),
    suggestion: diffInfo.originalFilepath,
  });

  // 将建议发送到服务器
  // ideProtocolClient.sendAcceptRejectSuggestion(accepted);

  // 将更新后的建议写回文件
  await writeFile(
    vscode.Uri.file(suggestionsPath),
    JSON.stringify(suggestions, null, 4),
  );
}