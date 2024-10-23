const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");
const { rimrafSync } = require("rimraf");
const {
  validateFilesPresent,
  execCmdSync,
  autodetectPlatformAndArch,
} = require("../../../scripts/util/index");

const continueDir = path.join(__dirname, "..", "..", "..");

function copyConfigSchema() {
  // 复制配置模式文件
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
}

function copyTokenizers() {
  // 复制 llamaTokenizerWorkerPool 文件
  fs.copyFileSync(
    path.join(__dirname, "../../../core/llm/llamaTokenizerWorkerPool.mjs"),
    path.join(__dirname, "../out/llamaTokenizerWorkerPool.mjs"),
  );
  console.log("[info] 已复制 llamaTokenizerWorkerPool");

  // 复制 llamaTokenizer 文件
  fs.copyFileSync(
    path.join(__dirname, "../../../core/llm/llamaTokenizer.mjs"),
    path.join(__dirname, "../out/llamaTokenizer.mjs"),
  );
  console.log("[info] 已复制 llamaTokenizer");
}

function installNodeModules() {
  // 确保在正确的目录中
  if (!process.cwd().endsWith("vscode")) {
    process.chdir(path.join(continueDir, "extensions", "vscode"));
  }

  // 安装 node_modules
  execCmdSync("npm install");
  console.log("[info] extensions/vscode 中的 npm install 已完成");

  process.chdir(path.join(continueDir, "gui"));

  execCmdSync("npm install");
  console.log("[info] gui 中的 npm install 已完成");
}

async function buildGui(isGhAction) {
  // 确保在正确的目录中
  if (!process.cwd().endsWith("gui")) {
    process.chdir(path.join(continueDir, "gui"));
  }
  if (isGhAction) {
    execCmdSync("npm run build");
  }

  // 将 dist 文件夹复制到 JetBrains 扩展中
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
          "[error] 将 React 应用构建复制到 JetBrains 扩展时出错: ",
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

  // 然后将 dist 文件夹复制到 VSCode 扩展中
  const vscodeGuiPath = path.join("../extensions/vscode/gui");
  fs.mkdirSync(vscodeGuiPath, { recursive: true });
  await new Promise((resolve, reject) => {
    ncp("dist", vscodeGuiPath, (error) => {
      if (error) {
        console.log(
          "将 React 应用构建复制到 VSCode 扩展时出错: ",
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
}

async function copyOnnxRuntimeFromNodeModules(target) {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
  fs.mkdirSync("bin", { recursive: true });

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
      console.warn("[info] 移除未使用的二进制文件时出错", e);
    }
  }
  console.log("[info] 已复制 onnxruntime-node");
}

async function copyTreeSitterWasms() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
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

  fs.copyFileSync(
    path.join(__dirname, "../../../core/vendor/tree-sitter.wasm"),
    path.join(__dirname, "../out/tree-sitter.wasm"),
  );
  console.log("[info] 已复制 tree-sitter wasms");
}

async function copyTreeSitterTagQryFiles() {
  // ncp(
  //   path.join(
  //     __dirname,
  //     "../../../core/node_modules/llm-code-highlighter/dist/tag-qry",
  //   ),
  //   path.join(__dirname, "../out/tag-qry"),
  //   (error) => {
  //     if (error)
  //       console.warn("复制 code-highlighter tag-qry 文件时出错", error);
  //   },
  // );
}

async function copyNodeModules() {
  // 复制 node_modules 以获取预构建的二进制文件
  process.chdir(path.join(continueDir, "extensions", "vscode"));

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
}

// async function downloadEsbuildBinary(isGhAction, isArm, target) {
//   process.chdir(path.join(continueDir, "extensions", "vscode"));

//   if (isGhAction && isArm) {
//     // 下载并解压 esbuild
//     console.log("[info] 下载预构建的 esbuild 二进制文件");
//     rimrafSync("node_modules/@esbuild");
//     fs.mkdirSync("node_modules/@esbuild", { recursive: true });
//     execCmdSync(
//       `curl -o node_modules/@esbuild/esbuild.zip https://continue-server-binaries.s3.us-west-1.amazonaws.com/${target}/esbuild.zip`,
//     );
//     execCmdSync(`cd node_modules/@esbuild && unzip esbuild.zip`);
//     fs.unlinkSync("node_modules/@esbuild/esbuild.zip");
//   } else {
//     // 从 npm 下载 esbuild 到 tmp 并复制
//     console.log("npm 安装 esbuild 二进制文件");
//     await installNodeModuleInTempDirAndCopyToCurrent(
//       "esbuild@0.17.19",
//       "@esbuild",
//     );
//   }
// }

async function downloadEsbuildBinary(target) {
  console.log("[info] 下载预构建的 esbuild 二进制文件");
  rimrafSync("out/node_modules/@esbuild");
  fs.mkdirSync(`out/node_modules/@esbuild/${target}/bin`, { recursive: true });
  fs.mkdirSync(`out/tmp`, { recursive: true });
  const downloadUrl = {
    "darwin-arm64":
      "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.17.19.tgz",
    "linux-arm64":
      "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.17.19.tgz",
    "win32-arm64":
      "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.17.19.tgz",
    "linux-x64":
      "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.17.19.tgz",
    "darwin-x64":
      "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.17.19.tgz",
    "win32-x64":
      "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.17.19.tgz",
  }[target];
  execCmdSync(`curl -L -o out/tmp/esbuild.tgz ${downloadUrl}`);
  execCmdSync("cd out/tmp && tar -xvzf esbuild.tgz");
  // 将安装的包复制回当前目录
  let tmpPath = "out/tmp/package/bin";
  let outPath = `out/node_modules/@esbuild/${target}/bin`;
  if (target.startsWith("win")) {
    tmpPath = "out/tmp/package";
    outPath = `out/node_modules/@esbuild/${target}`;
  }

  await new Promise((resolve, reject) => {
    ncp(
      path.join(tmpPath),
      path.join(outPath),
      { dereference: true },
      (error) => {
        if (error) {
          console.error(`[error] 复制 esbuild 包时出错`, error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
  rimrafSync("out/tmp");
}

async function downloadSqliteBinary(target) {
  console.log("[info] 下载预构建的 sqlite3 二进制文件");
  rimrafSync("../../core/node_modules/sqlite3/build");
  const downloadUrl = {
    "darwin-arm64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-arm64.tar.gz",
    "linux-arm64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-arm64.tar.gz",
    "win32-arm64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-win32-arm64.tar.gz",
    "linux-x64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-linux-x64.tar.gz",
    "darwin-x64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v6-darwin-x64.tar.gz",
    "win32-x64":
      "https://github.com/TryGhost/node-sqlite3/releases/download/v5.1.7/sqlite3-v5.1.7-napi-v3-win32-x64.tar.gz",
  }[target];
  execCmdSync(
    `curl -L -o ../../core/node_modules/sqlite3/build.tar.gz ${downloadUrl}`,
  );
  execCmdSync("cd ../../core/node_modules/sqlite3 && tar -xvzf build.tar.gz");
  fs.unlinkSync("../../core/node_modules/sqlite3/build.tar.gz");
}

async function copySqliteBinary() {
  process.chdir(path.join(continueDir, "extensions", "vscode"));
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
}

async function downloadRipgrepBinary(target) {
  console.log("[info] 下载预构建的 ripgrep 二进制文件");
  rimrafSync("node_modules/@vscode/ripgrep/bin");
  fs.mkdirSync("node_modules/@vscode/ripgrep/bin", { recursive: true });
  4;
  const downloadUrl = {
    "darwin-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-apple-darwin.tar.gz",
    "linux-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-unknown-linux-gnu.tar.gz",
    "win32-arm64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-aarch64-pc-windows-msvc.zip",
    "linux-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-unknown-linux-musl.tar.gz",
    "darwin-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-apple-darwin.tar.gz",
    "win32-x64":
      "https://github.com/microsoft/ripgrep-prebuilt/releases/download/v13.0.0-10/ripgrep-v13.0.0-10-x86_64-pc-windows-msvc.zip",
  }[target];

  if (target.startsWith("win")) {
    execCmdSync(
      `curl -L -o node_modules/@vscode/ripgrep/bin/build.zip ${downloadUrl}`,
    );
    execCmdSync("cd node_modules/@vscode/ripgrep/bin && unzip build.zip");
    fs.unlinkSync("node_modules/@vscode/ripgrep/bin/build.zip");
  } else {
    execCmdSync(
      `curl -L -o node_modules/@vscode/ripgrep/bin/build.tar.gz ${downloadUrl}`,
    );
    execCmdSync(
      "cd node_modules/@vscode/ripgrep/bin && tar -xvzf build.tar.gz",
    );
    fs.unlinkSync("node_modules/@vscode/ripgrep/bin/build.tar.gz");
  }
}

async function installNodeModuleInTempDirAndCopyToCurrent(packageName, toCopy) {
  console.log(`复制 ${packageName} 到 ${toCopy}`);
  // 这是一种只安装一个包而不让 npm 尝试安装所有依赖项的方法
  // 创建一个临时目录来安装包
  const adjustedName = packageName.replace(/@/g, "").replace("/", "-");

  const tempDir = `/tmp/continue-node_modules-${adjustedName}`;
  const currentDir = process.cwd();

  // 移除我们将要复制到的目录
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

    // 没有这个，文件似乎没有完全写入磁盘
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

module.exports = {
  copyConfigSchema,
  installNodeModules,
  buildGui,
  copyOnnxRuntimeFromNodeModules,
  copyTreeSitterWasms,
  copyTreeSitterTagQryFiles,
  copyNodeModules,
  downloadEsbuildBinary,
  copySqliteBinary,
  installNodeModuleInTempDirAndCopyToCurrent,
  downloadSqliteBinary,
  downloadRipgrepBinary,
  copyTokenizers,
};