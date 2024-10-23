import * as vscode from "vscode";
import type { VsCodeIde } from "../VsCodeIde";
import type { VsCodeWebviewProtocol } from "../webviewProtocol";

export const threadStopped: Map<number, boolean> = new Map();
// 数组性能更好，但在单个调试会话中你可能不会有成千上万个线程

export function registerDebugTracker(
  webviewProtocol: VsCodeWebviewProtocol,
  ide: VsCodeIde,
) {
  vscode.debug.registerDebugAdapterTrackerFactory("*", {
    createDebugAdapterTracker(_session: vscode.DebugSession) {
      const updateThreads = async () => {
        webviewProtocol?.request("updateSubmenuItems", {
          provider: "locals",
          submenuItems: (await ide.getAvailableThreads()).map((thread) => ({
            id: `${thread.id}`,
            title: thread.name,
            description: `${thread.id}`,
          })),
        });
      };

      return {
        async onWillStopSession() {
          threadStopped.clear();
          updateThreads();
        },
        async onDidSendMessage(message: any) {
          if (message.type === "event") {
            switch (message.event) {
              case "continued":
              case "stopped":
                if (typeof message.body.threadId !== "undefined")
                  threadStopped.set(
                    Number(message.body.threadId),
                    message.event === "stopped",
                  );

                if (message.body.allThreadsStopped)
                  threadStopped.forEach((_, key) =>
                    threadStopped.set(key, true),
                  );

                if (message.body.allThreadsContinued)
                  threadStopped.forEach((_, key) =>
                    threadStopped.set(key, false),
                  );

                updateThreads();
                break;

              case "thread":
                if (message.body.reason === "exited")
                  threadStopped.delete(Number(message.body.threadId));
                else if (message.body.reason === "started")
                  threadStopped.set(Number(message.body.threadId), false);
                // 在我的vscodium中，threadId不符合规范（调试C++）
                // 期望是一个数字，但却得到了一个字符串
                break;

              default:
                break;
            }
          }
        },
      };
    },
  });
}