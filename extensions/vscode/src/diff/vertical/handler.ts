import type { DiffLine } from "core";
import { ApplyState } from "core/protocol/ideWebview";
import * as vscode from "vscode";
import {
  DecorationTypeRangeManager,
  belowIndexDecorationType,
  greenDecorationType,
  indexDecorationType,
  redDecorationType,
} from "./decorations";
import type { VerticalDiffCodeLens } from "./manager";

export interface VerticalDiffHandlerOptions {
  input?: string;
  instant?: boolean;
  onStatusUpdate: (status: ApplyState["status"]) => void;
}

export class VerticalDiffHandler implements vscode.Disposable {
  private editor: vscode.TextEditor;
  private startLine: number;
  private endLine: number;
  private currentLineIndex: number;
  private cancelled = false;

  public get range(): vscode.Range {
    const startLine = Math.min(this.startLine, this.endLine);
    const endLine = Math.max(this.startLine, this.endLine);
    return new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
  }

  private newLinesAdded = 0;

  public options: VerticalDiffHandlerOptions;

  constructor(
    startLine: number,
    endLine: number,
    editor: vscode.TextEditor,
    private readonly editorToVerticalDiffCodeLens: Map<
      string,
      VerticalDiffCodeLens[]
    >,
    private readonly clearForFilepath: (
      filepath: string | undefined,
      accept: boolean,
    ) => void,
    private readonly refreshCodeLens: () => void,
    options: VerticalDiffHandlerOptions,
  ) {
    this.currentLineIndex = startLine;
    this.startLine = startLine;
    this.endLine = endLine;
    this.editor = editor;
    this.options = options;

    this.redDecorationManager = new DecorationTypeRangeManager(
      redDecorationType,
      this.editor,
    );
    this.greenDecorationManager = new DecorationTypeRangeManager(
      greenDecorationType,
      this.editor,
    );

    const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      // 当我们切换到这个编辑器时，需要重新绘制装饰
      if (editor?.document.uri.fsPath === this.filepath) {
        this.editor = editor;
        this.redDecorationManager.applyToNewEditor(editor);
        this.greenDecorationManager.applyToNewEditor(editor);
        this.updateIndexLineDecorations();
        this.refreshCodeLens();

        // 处理编辑器关闭时接收到的任何行
        this.queueDiffLine(undefined);
      }
    });
    this.disposables.push(disposable);
  }

  private get filepath() {
    return this.editor.document.uri.fsPath;
  }

  private deletionBuffer: string[] = [];
  private redDecorationManager: DecorationTypeRangeManager;
  insertedInCurrentBlock = 0;

  private async insertDeletionBuffer() {
    // 不要删除尾随空白行
    const totalDeletedContent = this.deletionBuffer.join("\n");
    if (
      totalDeletedContent === "" &&
      this.currentLineIndex >= this.endLine + this.newLinesAdded &&
      this.insertedInCurrentBlock === 0
    ) {
      return;
    }

    if (this.deletionBuffer.length || this.insertedInCurrentBlock > 0) {
      const blocks = this.editorToVerticalDiffCodeLens.get(this.filepath) || [];
      blocks.push({
        start: this.currentLineIndex - this.insertedInCurrentBlock,
        numRed: this.deletionBuffer.length,
        numGreen: this.insertedInCurrentBlock,
      });
      this.editorToVerticalDiffCodeLens.set(this.filepath, blocks);
    }

    if (this.deletionBuffer.length === 0) {
      this.insertedInCurrentBlock = 0;
      return;
    }

    // 插入删除行块
    await this.insertTextAboveLine(
      this.currentLineIndex - this.insertedInCurrentBlock,
      totalDeletedContent,
    );
    this.redDecorationManager.addLines(
      this.currentLineIndex - this.insertedInCurrentBlock,
      this.deletionBuffer.length,
    );
    // 向下移动绿色装饰
    this.greenDecorationManager.shiftDownAfterLine(
      this.currentLineIndex - this.insertedInCurrentBlock,
      this.deletionBuffer.length,
    );

    // 更新行索引，清空缓冲区
    for (let i = 0; i < this.deletionBuffer.length; i++) {
      this.incrementCurrentLineIndex();
    }
    this.deletionBuffer = [];
    this.insertedInCurrentBlock = 0;

    this.refreshCodeLens();
  }

  private incrementCurrentLineIndex() {
    this.currentLineIndex++;
    this.updateIndexLineDecorations();
  }

  private greenDecorationManager: DecorationTypeRangeManager;

  private async insertTextAboveLine(index: number, text: string) {
    await this.editor.edit(
      (editBuilder) => {
        const lineCount = this.editor.document.lineCount;
        if (index >= lineCount) {
          // 添加到文件末尾
          editBuilder.insert(
            new vscode.Position(
              lineCount,
              this.editor.document.lineAt(lineCount - 1).text.length,
            ),
            `\n${text}`,
          );
        } else {
          editBuilder.insert(new vscode.Position(index, 0), `${text}\n`);
        }
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    );
  }

  private async insertLineAboveIndex(index: number, line: string) {
    await this.insertTextAboveLine(index, line);
    this.greenDecorationManager.addLine(index);
    this.newLinesAdded++;
  }

  private async deleteLinesAt(index: number, numLines = 1) {
    const startLine = new vscode.Position(index, 0);
    await this.editor.edit(
      (editBuilder) => {
        editBuilder.delete(
          new vscode.Range(startLine, startLine.translate(numLines)),
        );
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    );
  }

  private updateIndexLineDecorations() {
    if (this.options.instant) {
      // 我们不在即时应用中显示进度
      return;
    }

    // 高亮显示 currentLineIndex 处的行
    // 并轻微高亮从该行到 endLine 的所有行
    if (this.currentLineIndex - this.newLinesAdded >= this.endLine) {
      this.editor.setDecorations(indexDecorationType, []);
      this.editor.setDecorations(belowIndexDecorationType, []);
    } else {
      const start = new vscode.Position(this.currentLineIndex, 0);
      this.editor.setDecorations(indexDecorationType, [
        new vscode.Range(
          start,
          new vscode.Position(start.line, Number.MAX_SAFE_INTEGER),
        ),
      ]);
      const end = new vscode.Position(this.endLine, 0);
      this.editor.setDecorations(belowIndexDecorationType, [
        new vscode.Range(start.translate(1), end.translate(this.newLinesAdded)),
      ]);
    }
  }

  private clearIndexLineDecorations() {
    this.editor.setDecorations(belowIndexDecorationType, []);
    this.editor.setDecorations(indexDecorationType, []);
  }

  public getLineDeltaBeforeLine(line: number) {
    // 返回当前活动的 diff 关闭时从文件中删除的行数
    let totalLineDelta = 0;
    for (const range of this.greenDecorationManager
      .getRanges()
      .sort((a, b) => a.start.line - b.start.line)) {
      if (range.start.line > line) {
        break;
      }

      totalLineDelta -= range.end.line - range.start.line + 1;
    }

    return totalLineDelta;
  }

  async clear(accept: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      false,
    );
    const rangesToDelete = accept
      ? this.redDecorationManager.getRanges()
      : this.greenDecorationManager.getRanges();

    this.redDecorationManager.clear();
    this.greenDecorationManager.clear();
    this.clearIndexLineDecorations();

    this.editorToVerticalDiffCodeLens.delete(this.filepath);

    await this.editor.edit(
      (editBuilder) => {
        for (const range of rangesToDelete) {
          editBuilder.delete(
            new vscode.Range(
              range.start,
              new vscode.Position(range.end.line + 1, 0),
            ),
          );
        }
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    );

    this.options.onStatusUpdate("closed");

    this.cancelled = true;
    this.refreshCodeLens();
    this.dispose();
  }

  disposables: vscode.Disposable[] = [];

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  get isCancelled() {
    return this.cancelled;
  }

  private _diffLinesQueue: DiffLine[] = [];
  private _queueLock = false;

  async queueDiffLine(diffLine: DiffLine | undefined) {
    if (diffLine) {
      this._diffLinesQueue.push(diffLine);
    }

    if (this._queueLock || this.editor !== vscode.window.activeTextEditor) {
      return;
    }

    this._queueLock = true;

    while (this._diffLinesQueue.length) {
      const line = this._diffLinesQueue.shift();
      if (!line) {
        break;
      }

      try {
        await this._handleDiffLine(line);
      } catch (e) {
        // 如果在调用 _handleDiffLine 和实际执行编辑之间切换了编辑器
        this._diffLinesQueue.push(line);
        break;
      }
    }

    this._queueLock = false;
  }

  private async _handleDiffLine(diffLine: DiffLine) {
    switch (diffLine.type) {
      case "same":
        await this.insertDeletionBuffer();
        this.incrementCurrentLineIndex();
        break;
      case "old":
        // 添加到删除缓冲区并暂时删除该行
        this.deletionBuffer.push(diffLine.line);
        await this.deleteLinesAt(this.currentLineIndex);
        break;
      case "new":
        await this.insertLineAboveIndex(this.currentLineIndex, diffLine.line);
        this.incrementCurrentLineIndex();
        this.insertedInCurrentBlock++;
        break;
    }
  }

  async run(diffLineGenerator: AsyncGenerator<DiffLine>) {
    try {
      // 作为加载的指示器
      this.updateIndexLineDecorations();

      for await (const diffLine of diffLineGenerator) {
        if (this.isCancelled) {
          return;
        }
        await this.queueDiffLine(diffLine);
      }

      // 清空删除缓冲区
      await this.insertDeletionBuffer();
      this.clearIndexLineDecorations();

      this.refreshCodeLens();

      this.options.onStatusUpdate("done");

      // 用户输入时拒绝
      // const listener = vscode.workspace.onDidChangeTextDocument((e) => {
      //   if (e.document.uri.fsPath === this.filepath) {
      //     this.clear(false);
      //     listener.dispose();
      //   }
      // });
    } catch (e) {
      this.clearForFilepath(this.filepath, false);
      throw e;
    }
  }

  async acceptRejectBlock(
    accept: boolean,
    startLine: number,
    numGreen: number,
    numRed: number,
  ) {
    if (numGreen > 0) {
      // 删除编辑器装饰
      this.greenDecorationManager.deleteRangeStartingAt(startLine + numRed);
      if (!accept) {
        // 删除实际行
        await this.deleteLinesAt(startLine + numRed, numGreen);
      }
    }

    if (numRed > 0) {
      const rangeToDelete =
        this.redDecorationManager.deleteRangeStartingAt(startLine);

      if (accept) {
        // 删除实际行
        await this.deleteLinesAt(startLine, numRed);
      }
    }

    // 向上移动下面的所有内容
    const offset = -(accept ? numRed : numGreen);
    this.redDecorationManager.shiftDownAfterLine(startLine, offset);
    this.greenDecorationManager.shiftDownAfterLine(startLine, offset);

    // 移动代码镜头对象
    this.shiftCodeLensObjects(startLine, offset);
  }

  private shiftCodeLensObjects(startLine: number, offset: number) {
    // 移动代码镜头对象
    const blocks =
      this.editorToVerticalDiffCodeLens
        .get(this.filepath)
        ?.filter((x) => x.start !== startLine)
        .map((x) => {
          if (x.start > startLine) {
            return { ...x, start: x.start + offset };
          }
          return x;
        }) || [];
    this.editorToVerticalDiffCodeLens.set(this.filepath, blocks);

    this.refreshCodeLens();
  }

  public updateLineDelta(
    filepath: string,
    startLine: number,
    lineDelta: number,
  ) {
    // 检索给定文件的差异块
    const blocks = this.editorToVerticalDiffCodeLens.get(filepath);
    if (!blocks) {
      return;
    }

    // 更新装饰
    this.redDecorationManager.shiftDownAfterLine(startLine, lineDelta);
    this.greenDecorationManager.shiftDownAfterLine(startLine, lineDelta);

    // 更新代码镜头
    this.shiftCodeLensObjects(startLine, lineDelta);
  }
}