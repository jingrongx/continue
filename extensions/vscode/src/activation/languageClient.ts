/**
 * 如果我们想从扩展中运行或使用另一个语言服务器，这就是我们如何做到的。
 */

import * as path from "node:path";
import { type ExtensionContext, extensions, workspace } from "vscode";

import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  State,
  type StateChangeEvent,
  TransportKind,
} from "vscode-languageclient/node";
import { getExtensionUri } from "../util/vscode";

let client: LanguageClient;

export async function startLanguageClient(context: ExtensionContext) {
  const pythonLS = startPythonLanguageServer(context);
  pythonLS.start();
}

export async function makeRequest(method: string, param: any): Promise<any> {
  if (!client) {
    return;
  } else if (client.state === State.Starting) {
    return new Promise((resolve, reject) => {
      const stateListener = client.onDidChangeState((e: StateChangeEvent) => {
        if (e.newState === State.Running) {
          stateListener.dispose();
          resolve(client.sendRequest(method, param));
        } else if (e.newState === State.Stopped) {
          stateListener.dispose();
          reject(new Error("语言服务器意外停止"));
        }
      });
    });
  } else {
    return client.sendRequest(method, param);
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function startPythonLanguageServer(context: ExtensionContext): LanguageClient {
  const extensionPath = getExtensionUri().fsPath;
  const command = `cd ${path.join(
    extensionPath,
    "scripts",
  )} && source env/bin/activate.fish && python -m pyls`;
  const serverOptions: ServerOptions = {
    command: command,
    args: ["-vv"],
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: ["python"],
    synchronize: {
      configurationSection: "pyls",
    },
  };
  return new LanguageClient(command, serverOptions, clientOptions)
}

async function startPylance(context: ExtensionContext) {
  const pylance = extensions.getExtension("ms-python.vscode-pylance");
  await pylance?.activate();
  if (!pylance) {
    return;
  }
  const { path: lsPath } = await pylance.exports.languageServerFolder();

  // 服务器在 node 中实现
  const serverModule = context.asAbsolutePath(lsPath);
  // 服务器的调试选项
  // --inspect=6009: 以 Node 的 Inspector 模式运行服务器，以便 VS Code 可以附加到服务器进行调试
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // 如果扩展在调试模式下启动，则使用调试服务器选项
  // 否则使用运行选项
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // 控制语言客户端的选项
  const clientOptions: LanguageClientOptions = {
    // 为纯文本文档注册服务器
    documentSelector: [{ scheme: "file", language: "python" }],
    synchronize: {
      // 通知服务器工作区中包含的 '.clientrc 文件的更改
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // 创建语言客户端并启动客户端。
  client = new LanguageClient(
    "languageServerExample",
    "语言服务器示例",
    serverOptions,
    clientOptions,
  );
  return client;
}