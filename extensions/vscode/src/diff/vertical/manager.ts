import { ConfigHandler } from "core/config/ConfigHandler";
import { pruneLinesFromBottom, pruneLinesFromTop } from "core/llm/countTokens";
import { getMarkdownLanguageTagForFile } from "core/util";

import { DiffLine } from "core";
import { streamDiffLines } from "core/edit/streamDiffLines";
import * as vscode from "vscode";
import { VsCodeWebviewProtocol } from "../../webviewProtocol";
import { VerticalDiffHandler, VerticalDiffHandlerOptions } from "./handler";

export interface VerticalDiffCodeLens {
  start: number;
  numRed: number;
  numGreen: number;
}

export class VerticalDiffManager {
  public refreshCodeLens: () => void = () => {};

  private filepathToHandler: Map<string, VerticalDiffHandler> = new Map();

  filepathToCodeLens: Map<string, VerticalDiffCodeLens[]> = new Map();

  private userChangeListener: vscode.Disposable | undefined;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly webviewProtocol: VsCodeWebviewProtocol,
  ) {
    this.userChangeListener = undefined;
  }

  createVerticalDiffHandler(
    filepath: string,
    startLine: number,
    endLine: number,
    options: VerticalDiffHandlerOptions,
  ) {
    if (this.filepathToHandler.has(filepath)) {
      this.filepathToHandler.get(filepath)?.clear(false);
      this.filepathToHandler.delete(filepath);
    }
    const editor = vscode.window.activeTextEditor; // TODO
    if (editor && editor.document.uri.fsPath === filepath) {
      const handler = new VerticalDiffHandler(
        startLine,
        endLine,
        editor,
        this.filepathToCodeLens,
        this.clearForFilepath.bind(this),
        this.refreshCodeLens,
        options,
      );
      this.filepathToHandler.set(filepath, handler);
      return handler;
    } else {
      return undefined;
    }
  }

  getHandlerForFile(filepath: string) {
    return this.filepathToHandler.get(filepath);
  }

  // 创建一个监听器，用于监听用户对文档的更改。
  private enableDocumentChangeListener(): vscode.Disposable | undefined {
    if (this.userChangeListener) {
      // 每个文件只创建一个监听器
      return;
    }

    this.userChangeListener = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        // 检查受影响的文件是否有活动的处理器
        const filepath = event.document.uri.fsPath;
        const handler = this.getHandlerForFile(filepath);
        if (handler) {
          // 如果该文件有活动的差异处理器，处理文档更改
          this.handleDocumentChange(event, handler);
        }
      },
    );
  }

  // 在继续更新文本文档时禁用用户文档更改的监听器
  public disableDocumentChangeListener() {
    if (this.userChangeListener) {
      this.userChangeListener.dispose();
      this.userChangeListener = undefined;
    }
  }

  private handleDocumentChange(
    event: vscode.TextDocumentChangeEvent,
    handler: VerticalDiffHandler,
  ) {
    // 遍历事件中的每个更改
    event.contentChanges.forEach((change) => {
      // 计算添加或删除的行数
      const linesAdded = change.text.split("\n").length - 1;
      const linesDeleted = change.range.end.line - change.range.start.line;
      const lineDelta = linesAdded - linesDeleted;

      // 使用新的行增量更新差异处理器
      handler.updateLineDelta(
        event.document.uri.fsPath,
        change.range.start.line,
        lineDelta,
      );
    });
  }

  clearForFilepath(filepath: string | undefined, accept: boolean) {
    if (!filepath) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      filepath = activeEditor.document.uri.fsPath;
    }

    const handler = this.filepathToHandler.get(filepath);
    if (handler) {
      handler.clear(accept);
      this.filepathToHandler.delete(filepath);
    }

    this.disableDocumentChangeListener();

    vscode.commands.executeCommand("setContext", "continue.diffVisible", false);
  }

  async acceptRejectVerticalDiffBlock(
    accept: boolean,
    filepath?: string,
    index?: number,
  ) {
    if (!filepath) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      filepath = activeEditor.document.uri.fsPath;
    }

    if (typeof index === "undefined") {
      index = 0;
    }

    const blocks = this.filepathToCodeLens.get(filepath);
    const block = blocks?.[index];
    if (!blocks || !block) {
      return;
    }

    const handler = this.getHandlerForFile(filepath);
    if (!handler) {
      return;
    }

    // 在继续进行更改时禁用对文件更改的监听
    this.disableDocumentChangeListener();

    // CodeLens 对象从 editorToVerticalDiffCodeLens 中移除
    await handler.acceptRejectBlock(
      accept,
      block.start,
      block.numGreen,
      block.numRed,
    );

    if (blocks.length === 1) {
      this.clearForFilepath(filepath, true);
    } else {
      // 重新启用对文件用户更改的监听器
      this.enableDocumentChangeListener();
    }
  }

  async streamDiffLines(
    diffStream: AsyncGenerator<DiffLine>,
    instant: boolean,
    streamId: string,
  ) {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);

    // 获取当前编辑器的文件路径/范围
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const filepath = editor.document.uri.fsPath;
    const startLine = 0;
    const endLine = editor.document.lineCount - 1;

    // 检查同一文件中是否存在要创建的新处理器
    const existingHandler = this.getHandlerForFile(filepath);
    if (existingHandler) {
      existingHandler.clear(false);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    // 使用确定的开始/结束创建新处理器
    const diffHandler = this.createVerticalDiffHandler(
      filepath,
      startLine,
      endLine,
      {
        instant,
        onStatusUpdate: (status) =>
          this.webviewProtocol.request("updateApplyState", {
            streamId,
            status,
          }),
      },
    );

    if (!diffHandler) {
      console.warn("创建新的垂直差异处理器时出现问题");
      return;
    }

    if (editor.selection) {
      // 取消选择范围
      editor.selection = new vscode.Selection(
        editor.selection.active,
        editor.selection.active,
      );
    }

    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      true,
    );

    try {
      await diffHandler.run(diffStream);

      // 在差异打开时启用对文件用户编辑的监听器
      this.enableDocumentChangeListener();
    } catch (e) {
      this.disableDocumentChangeListener();
      vscode.window.showErrorMessage(`流式传输差异时出错: ${e}`);
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }

  /**
   * 根据用户输入和模型输出流式传输对当前文档的编辑。
   *
   * @param input - 用户的输入或编辑指令。
   * @param modelTitle - 要使用的语言模型的标题。
   * @param [onlyOneInsertion] - 可选标志以限制编辑为单个插入。
   * @param [quickEdit] - 指示这是否是快速编辑的可选字符串。
   * @param [range] - 可选范围，用于替代高亮文本。请注意，`quickEdit`属性目前不能与`range`一起传递，因为它假定有一个活动选择。
   *
   * 此方法执行以下步骤：
   * 1. 设置编辑器上下文以进行差异。
   * 2. 确定要编辑的文本范围。
   * 3. 清除文件的任何现有差异处理器。
   * 4. 创建新的垂直差异处理器。
   * 5. 为语言模型准备上下文（前缀和后缀）。
   * 6. 从语言模型中流式传输差异行。
   * 7. 将更改应用于文档。
   * 8. 设置监听器以进行后续用户编辑。
   *
   * 该方法处理各种边缘情况，例如快速编辑和现有差异，并管理差异处理器和文档更改监听器的生命周期。
   */
  async streamEdit(
    input: string,
    modelTitle: string | undefined,
    streamId?: string,
    onlyOneInsertion?: boolean,
    quickEdit?: string,
    range?: vscode.Range,
  ) {
    vscode.commands.executeCommand("setContext", "continue.diffVisible", true);

    let editor = vscode.window.activeTextEditor;

    if (!editor) {
      return;
    }

    const filepath = editor.document.uri.fsPath;

    let startLine, endLine: number;

    if (range) {
      startLine = range.start.line;
      endLine = range.end.line;
    } else {
      startLine = editor.selection.start.line;
      endLine = editor.selection.end.line;
    }

    // 检查同一文件中是否存在要创建的新处理器
    const existingHandler = this.getHandlerForFile(filepath);

    if (existingHandler) {
      if (quickEdit) {
        // 之前的差异是快速编辑
        // 检查用户是否已突出显示范围
        let rangeBool =
          startLine != endLine ||
          editor.selection.start.character != editor.selection.end.character;

        // 检查范围是否与之前的范围不同
        let newRangeBool =
          startLine != existingHandler.range.start.line ||
          endLine != existingHandler.range.end.line;

        if (!rangeBool || !newRangeBool) {
          // 用户未突出显示新范围 -> 使用之前快速编辑的开始/结束
          startLine = existingHandler.range.start.line;
          endLine = existingHandler.range.end.line;
        }
      }

      // 清除之前的处理器
      // 这允许用户在更改区域上方进行编辑，
      // 但每行由 Continue 生成的额外增量已添加
      // 在添加此内容之前，我们需要区分人类和 Continue
      // let effectiveLineDelta =
      //   existingHandler.getLineDeltaBeforeLine(startLine);
      // startLine += effectiveLineDelta;
      // endLine += effectiveLineDelta;

      existingHandler.clear(false);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    // 使用确定的开始/结束创建新处理器
    const diffHandler = this.createVerticalDiffHandler(
      filepath,
      startLine,
      endLine,
      {
        input,
        onStatusUpdate: (status) =>
          streamId &&
          this.webviewProtocol.request("updateApplyState", {
            streamId,
            status,
          }),
      },
    );

    if (!diffHandler) {
      console.warn("创建新的垂直差异处理器时出现问题");
      return;
    }

    let selectedRange = diffHandler.range;

    // 仅当选择为空时，使用精确的前缀/后缀而不是按行
    if (selectedRange.isEmpty) {
      selectedRange = new vscode.Range(
        editor.selection.start.with(undefined, 0),
        editor.selection.end.with(undefined, Number.MAX_SAFE_INTEGER),
      );
    }

    const llm = await this.configHandler.llmFromTitle(modelTitle);
    const rangeContent = editor.document.getText(selectedRange);
    const prefix = pruneLinesFromTop(
      editor.document.getText(
        new vscode.Range(new vscode.Position(0, 0), selectedRange.start),
      ),
      llm.contextLength / 4,
      llm.model,
    );
    const suffix = pruneLinesFromBottom(
      editor.document.getText(
        new vscode.Range(
          selectedRange.end,
          new vscode.Position(editor.document.lineCount, 0),
        ),
      ),
      llm.contextLength / 4,
      llm.model,
    );

    if (editor.selection) {
      // 取消选择范围
      editor.selection = new vscode.Selection(
        editor.selection.active,
        editor.selection.active,
      );
    }

    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      true,
    );

    try {
      await diffHandler.run(
        streamDiffLines(
          prefix,
          rangeContent,
          suffix,
          llm,
          input,
          getMarkdownLanguageTagForFile(filepath),
          onlyOneInsertion,
        ),
      );

      // 在差异打开时启用对文件用户编辑的监听器
      this.enableDocumentChangeListener();
    } catch (e) {
      this.disableDocumentChangeListener();
      vscode.window.showErrorMessage(`流式传输差异时出错: ${e}`);
    } finally {
      vscode.commands.executeCommand(
        "setContext",
        "continue.streamingDiff",
        false,
      );
    }
  }
}