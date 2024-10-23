const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");
const { rimrafSync } = require("rimraf");
const {
  validateFilesPresent,
  execCmdSync,
  autodetectPlatformAndArch,
} = require("../../../scripts/util/index");

// 清理将要打包的文件夹以确保干净的环境
rimrafSync(path.join(__dirname, "..", "bin"));
rimrafSync(path.join(__dirname, "..", "out"));
fs.mkdirSync(path.join(__dirname, "..", "out", "node_modules"), {
  recursive: true,
});
const guiDist = path.join(__dirname, "..", "..", "..", "gui", "dist");
if (!fs.existsSync(guiDist)) {
  fs.mkdirSync(guiDist, { recursive: true });
}

// 获取要打包的目标
let target = undefined;
const args = process.argv;
if (args[2] === "--target") {
  target = args[3];
}

let os;
let arch;
if (!target) {
  [os, arch] = autodetectPlatformAndArch();
} else {
  [os, arch] = target.split("-");
}

if (os === "alpine") {
  os = "linux";
}
if (arch === "armhf") {
  arch = "arm64";
}
target = `${os}-${arch}`;
console.log("[info] 使用目标: ", target);

const exe = os === "win32" ? ".exe" : "";

(async () => {
  console.log("[info] 为目标打包扩展 ", target);

  // 复制 config_schema.json 到 docs 和 intellij 中的 config.json
  fs.copyFileSync(
    "config_schema.json",
    path.join("..", "..", "docs", "static", "schemas", "config.json"),
  );
  fs.copyFileSync(
    "config_schema.json",
    path.join(
      "..",
      "intellij",
      "src",
      "main",
      "resources",
      "config_schema.json",
    ),
  );
  // 修改并复制 .continuerc.json
  const schema = JSON.parse(fs.readFileSync("config_schema.json", "utf8"));
  schema.definitions.SerializedContinueConfig.properties.mergeBehavior = {
    type: "string",
    enum: ["merge", "overwrite"],
    default: "merge",
    title: "合并行为",
    markdownDescription:
      "如果设置为 'merge'，.continuerc.json 将在 config.json 之上应用（数组和对象将被合并）。如果设置为 'overwrite'，则 .continuerc.json 的每个顶级属性将覆盖 config.json 中的该属性。",
  };
  fs.writeFileSync("continue_rc_schema.json", JSON.stringify(schema, null, 2));

  if (!process.cwd().endsWith("vscode")) {
    // 有时会从根目录运行（例如在 VS Code 任务中）
    process.chdir("extensions/vscode");
  }

  // 安装 node_modules //
  execCmdSync("npm install");
  console.log("[info] 在 extensions/vscode 中完成 npm install");

  process.chdir("../../gui");

  execCmdSync("npm install");
  console.log("[info] 在 gui 中完成 npm install");

  if (ghAction()) {
    execCmdSync("npm run build");
  }

  // 将 dist 文件夹复制到 JetBrains 扩展 //
  const intellijExtensionWebviewPath = path.join(
    "..",
    "extensions",
    "intellij",
    "src",
    "main",
    "resources",
    "webview",
  );

  const indexHtmlPath = path.join(intellijExtensionWebviewPath, "index.html");
  fs.copyFileSync(indexHtmlPath, "tmp_index.html");
  rimrafSync(intellijExtensionWebviewPath);
  fs.mkdirSync(intellijExtensionWebviewPath, { recursive: true });

  await new Promise((resolve, reject) => {
    ncp("dist", intellijExtensionWebviewPath, (error) => {
      if (error) {
        console.warn(
          "[error] 复制 React 应用构建到 JetBrains 扩展时出错: ",
          error,
        );
        reject(error);
      }
      resolve();
    });
  });

  // 放回 index.html
  if (fs.existsSync(indexHtmlPath)) {
    rimrafSync(indexHtmlPath);
  }
  fs.copyFileSync("tmp_index.html", indexHtmlPath);
  fs.unlinkSync("tmp_index.html");

  // 复制其他杂项文件
  fs.copyFileSync(
    "../extensions/vscode/gui/onigasm.wasm",
    path.join(intellijExtensionWebviewPath, "onigasm.wasm"),
  );

  console.log("[info] 已将 gui 构建复制到 JetBrains 扩展");

  // 然后将 dist 文件夹复制到 VSCode 扩展 //
  const vscodeGuiPath = path.join("../extensions/vscode/gui");
  fs.mkdirSync(vscodeGuiPath, { recursive: true });
  await new Promise((resolve, reject) => {
    ncp("dist", vscodeGuiPath, (error) => {
      if (error) {
        console.log(
          "复制 React 应用构建到 VSCode 扩展时出错: ",
          error,
        );
        reject(error);
      } else {
        console.log("已将 gui 构建复制到 VSCode 扩展");
        resolve();
      }
    });
  });

  if (!fs.existsSync(path.join("dist", "assets", "index.js"))) {
    throw new Error("gui 构建未生成 index.js");
  }
  if (!fs.existsSync(path.join("dist", "assets", "index.css"))) {
    throw new Error("gui 构建未生成 index.css");
  }

  // 复制本地 / wasm 模块 //
  process.chdir("../extensions/vscode");

  fs.mkdirSync("bin", { recursive: true });

  // onnxruntime-node
  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/onnxruntime-node/bin"),
      path.join(__dirname, "../bin"),
      {
        dereference: true,
      },
      (error) => {
        if (error) {
          console.warn("[info] 复制 onnxruntime-node 文件时出错", error);
          reject(error);
        }
        resolve();
      },
    );
  });
  if (target) {
    // 如果是生产构建，只需要当前平台的二进制文件
    try {
      if (!target.startsWith("darwin")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/darwin"));
      }
      if (!target.startsWith("linux")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/linux"));
      }
      if (!target.startsWith("win")) {
        rimrafSync(path.join(__dirname, "../bin/napi-v3/win32"));
      }

      // 也不想包含 cuda/shared/tensorrt 二进制文件，它们太大了
      if (target.startsWith("linux")) {
        const filesToRemove = [
          "libonnxruntime_providers_cuda.so",
          "libonnxruntime_providers_shared.so",
          "libonnxruntime_providers_tensorrt.so",
        ];
        filesToRemove.forEach((file) => {
          const filepath = path.join(
            __dirname,
            "../bin/napi-v3/linux/x64",
            file,
          );
          if (fs.existsSync(filepath)) {
            fs.rmSync(filepath);
          }
        });
      }
    } catch (e) {
      console.warn("[info] 删除未使用的二进制文件时出错", e);
    }
  }
  console.log("[info] 已复制 onnxruntime-node");

  // tree-sitter-wasm
  fs.mkdirSync("out", { recursive: true });

  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/tree-sitter-wasms/out"),
      path.join(__dirname, "../out/tree-sitter-wasms"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] 复制 tree-sitter-wasm 文件时出错", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  const filesToCopy = [
    "../../../core/vendor/tree-sitter.wasm",
    "../../../core/llm/llamaTokenizerWorkerPool.mjs",
    "../../../core/llm/llamaTokenizer.mjs",
    "../../../core/llm/tiktokenWorkerPool.mjs",
  ];

  for (const f of filesToCopy) {
    fs.copyFileSync(
      path.join(__dirname, f),
      path.join(__dirname, "..", "out", path.basename(f)),
    );
    console.log(`[info] 已复制 ${path.basename(f)}`);
  }

  // tree-sitter 标签查询文件
  // ncp(
  //   path.join(
  //     __dirname,
  //     "../../../core/node_modules/llm-code-highlighter/dist/tag-qry",
  //   ),
  //   path.join(__dirname, "../out/tag-qry"),
  //   (error) => {
  //     if (error)
  //       console.warn("复制 code-highlighter 标签查询文件时出错", error);
  //   },
  // );

  // textmate-syntaxes
  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../textmate-syntaxes"),
      path.join(__dirname, "../gui/textmate-syntaxes"),
      (error) => {
        if (error) {
          console.warn("[error] 复制 textmate-syntaxes 时出错", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  function ghAction() {
    return !!process.env.GITHUB_ACTIONS;
  }

  function isArm() {
    return (
      target === "darwin-arm64" ||
      target === "linux-arm64" ||
      target === "win32-arm64"
    );
  }

  function isWin() {
    return target?.startsWith("win");
  }

  async function installNodeModuleInTempDirAndCopyToCurrent(
    packageName,
    toCopy,
  ) {
    console.log(`复制 ${packageName} 到 ${toCopy}`);
    // 这是一种只安装一个包而不让 npm 尝试安装所有依赖项的方法
    // 创建一个临时目录来安装包
    const adjustedName = packageName.replace(/@/g, "").replace("/", "-");

    const tempDir = `/tmp/continue-node_modules-${adjustedName}`;
    const currentDir = process.cwd();

    // 删除将要复制到的目录
    rimrafSync(`node_modules/${toCopy}`);

    // 确保临时目录存在
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // 移动到临时目录
      process.chdir(tempDir);

      // 初始化一个新的 package.json 并安装包
      execCmdSync(`npm init -y && npm i -f ${packageName} --no-save`);

      console.log(
        `内容: ${packageName}`,
        fs.readdirSync(path.join(tempDir, "node_modules", toCopy)),
      );

      // 没有这个似乎文件没有完全写入磁盘
      // 理想情况下，我们在最后的验证中验证文件完整性
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 将安装的包复制回当前目录
      await new Promise((resolve, reject) => {
        ncp(
          path.join(tempDir, "node_modules", toCopy),
          path.join(currentDir, "node_modules", toCopy),
          { dereference: true },
          (error) => {
            if (error) {
              console.error(
                `[error] 复制 ${packageName} 包时出错`,
                error,
              );
              reject(error);
            } else {
              resolve();
            }
          },
        );
      });
    } finally {
      // 清理临时目录
      // rimrafSync(tempDir);

      // 返回原始目录
      process.chdir(currentDir);
    }
  }

  // GitHub Actions 不支持 ARM，因此我们需要下载预先保存的二进制文件
  if (ghAction() && isArm()) {
    // sqlite3
    if (!isWin()) {
      // lancedb 和 sqlite3 都没有预构建的 Windows arm64 二进制文件

      // lancedb 二进制文件
      const packageToInstall = {
        "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
        "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
      }[target];
      console.log(
        "[info] 下载预构建的 lancedb 二进制文件: " + packageToInstall,
      );

      await installNodeModuleInTempDirAndCopyToCurrent(
        packageToInstall,
        "@lancedb",
      );

      // 替换安装的预构建
      console.log("[info] 下载预构建的 sqlite3 二进制文件");
      rimrafSync("../../core/node_modules/sqlite3/build");
      const downloadUrl = {
        "darwin-arm64":
          "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
        "linux-arm64":
          "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
      }[target];
      execCmdSync(
        `curl -L -o ../../core/node_modules/sqlite3/build.tar.gz ${downloadUrl}`,
      );
      execCmdSync(
        "cd ../../core/node_modules/sqlite3 && tar -xvzf build.tar.gz",
      );
      fs.unlinkSync("../../core/node_modules/sqlite3/build.tar.gz");
    }

    // 下载并解压 esbuild
    console.log("[info] 下载预构建的 esbuild 二进制文件");
    rimrafSync("node_modules/@esbuild");
    fs.mkdirSync("node_modules/@esbuild", { recursive: true });
    execCmdSync(
      `curl -o node_modules/@esbuild/esbuild.zip https://continue-server-binaries.s3.us-west-1.amazonaws.com/${target}/esbuild.zip`,
    );
    execCmdSync(`cd node_modules/@esbuild && unzip esbuild.zip`);
    fs.unlinkSync("node_modules/@esbuild/esbuild.zip");
  } else {
    // 从 npm 下载 esbuild 到 tmp 并复制
    console.log("npm 安装 esbuild 二进制文件");
    await installNodeModuleInTempDirAndCopyToCurrent(
      "esbuild@0.17.19",
      "@esbuild",
    );
  }

  console.log("[info] 从 core 复制 sqlite 节点绑定");
  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/sqlite3/build"),
      path.join(__dirname, "../out/build"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] 复制 sqlite3 文件时出错", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  // 也复制到这里以供 VS Code 测试套件使用
  await new Promise((resolve, reject) => {
    ncp(
      path.join(__dirname, "../../../core/node_modules/sqlite3/build"),
      path.join(__dirname, "../out"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] 复制 sqlite3 文件时出错", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  // 复制预构建二进制文件的 node_modules
  const NODE_MODULES_TO_COPY = [
    "esbuild",
    "@esbuild",
    "@lancedb",
    "@vscode/ripgrep",
    "workerpool",
  ];

  fs.mkdirSync("out/node_modules", { recursive: true });

  await Promise.all(
    NODE_MODULES_TO_COPY.map(
      (mod) =>
        new Promise((resolve, reject) => {
          fs.mkdirSync(`out/node_modules/${mod}`, { recursive: true });
          ncp(
            `node_modules/${mod}`,
            `out/node_modules/${mod}`,
            { dereference: true },
            function (error) {
              if (error) {
                console.error(`[error] 复制 ${mod} 时出错`, error);
                reject(error);
              } else {
                console.log(`[info] 已复制 ${mod}`);
                resolve();
              }
            },
          );
        }),
    ),
  );

  console.log(`[info] 已复制 ${NODE_MODULES_TO_COPY.join(", ")}`);

  // 复制任何工作文件
  fs.cpSync(
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
    "out/xhr-sync-worker.js",
  );

  // 验证所有必要的文件是否存在
  validateFilesPresent([
    // 用于创建 @code 上下文提供程序索引的查询
    "tree-sitter/code-snippet-queries/c_sharp.scm",

    // 用于 @outline 和 @highlights 上下文提供程序的查询
    "tag-qry/tree-sitter-c_sharp-tags.scm",

    // onnx 运行时绑定
    `bin/napi-v3/${os}/${arch}/onnxruntime_binding.node`,
    `bin/napi-v3/${os}/${arch}/${
      os === "darwin"
        ? "libonnxruntime.1.14.0.dylib"
        : os === "linux"
        ? "libonnxruntime.so.1.14.0"
        : "onnxruntime.dll"
    }`,
    "builtin-themes/dark_modern.json",

    // 侧边栏的代码/样式
    "gui/assets/index.js",
    "gui/assets/index.css",

    // 教程
    "media/move-chat-panel-right.md",
    "continue_tutorial.py",
    "config_schema.json",

    // 嵌入模型
    "models/all-MiniLM-L6-v2/config.json",
    "models/all-MiniLM-L6-v2/special_tokens_map.json",
    "models/all-MiniLM-L6-v2/tokenizer_config.json",
    "models/all-MiniLM-L6-v2/tokenizer.json",
    "models/all-MiniLM-L6-v2/vocab.txt",
    "models/all-MiniLM-L6-v2/onnx/model_quantized.onnx",

    // node_modules（有点令人困惑为什么这是必要的）
    `node_modules/@vscode/ripgrep/bin/rg${exe}`,

    // out 目录（extension.js 所在的位置）
    // "out/extension.js", 这是由 vsce 之后生成的
    // web-tree-sitter
    "out/tree-sitter.wasm",
    // jsdom 所需的工作程序
    "out/xhr-sync-worker.js",
    // SQLite3 Node 本地模块
    "out/build/Release/node_sqlite3.node",

    // out/node_modules（由 extension.js 访问）
    `out/node_modules/@vscode/ripgrep/bin/rg${exe}`,
    `out/node_modules/@esbuild/${
      target === "win32-arm64"
        ? "esbuild.exe"
        : target === "win32-x64"
        ? "win32-x64/esbuild.exe"
        : `${target}/bin/esbuild`
    }`,
    `out/node_modules/@lancedb/vectordb-${
      os === "win32"
        ? "win32-x64-msvc"
        : `${target}${os === "linux" ? "-gnu" : ""}`
    }/index.node`,
    `out/node_modules/esbuild/lib/main.js`,
    `out/node_modules/esbuild/bin/esbuild`,
  ]);
})();