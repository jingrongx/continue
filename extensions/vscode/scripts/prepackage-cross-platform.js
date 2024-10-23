/**
 * 这是 `prepackage.js` 的实验性副本，旨在以完全跨平台的方式构建扩展。
 * 这不是我们用于实际构建的文件。
 * 它也尚未完成。当前状态是刚开始重构。
 */

const fs = require("fs");
const path = require("path");
const { rimrafSync } = require("rimraf");
const {
  validateFilesPresent,
  autodetectPlatformAndArch,
} = require("../../../scripts/util/index");
const {
  copyConfigSchema,
  installNodeModules,
  buildGui,
  copyOnnxRuntimeFromNodeModules,
  copyTreeSitterWasms,
  copyTreeSitterTagQryFiles,
  copyNodeModules,
  downloadEsbuildBinary,
  downloadRipgrepBinary,
  copySqliteBinary,
  installNodeModuleInTempDirAndCopyToCurrent,
  downloadSqliteBinary,
  copyTokenizers,
} = require("./utils");

// 清除将被打包的文件夹以确保干净的环境
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

console.log("[info] 使用目标: ", target);

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

async function package(target, os, arch, exe) {
  console.log("[info] 为目标打包扩展 ", target);

  // 将 config_schema.json 复制到 docs 和 intellij 中的 config.json
  copyConfigSchema();

  // 安装 node_modules
  installNodeModules();

  // 构建 GUI 并复制到扩展中
  await buildGui(ghAction());

  // 资源
  // 复制 tree-sitter-wasm 文件
  await copyTreeSitterWasms();

  // 复制 tree-sitter 标签查询文件
  await copyTreeSitterTagQryFiles();

  // 安装并复制本地模块
  // *** onnxruntime-node ***
  await copyOnnxRuntimeFromNodeModules(target);

  // 将 llama tokenizers 复制到 out
  copyTokenizers();

  // *** 安装 @lancedb 二进制文件 ***
  const lancePackageToInstall = {
    "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
    "darwin-x64": "@lancedb/vectordb-darwin-x64",
    "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
    "linux-x64": "@lancedb/vectordb-linux-x64-gnu",
    "win32-x64": "@lancedb/vectordb-win32-x64-msvc",
    "win32-arm64": "@lancedb/vectordb-win32-x64-msvc", // 他们没有 win32-arm64 构建
  }[target];
  await installNodeModuleInTempDirAndCopyToCurrent(
    lancePackageToInstall,
    "@lancedb",
  );
  // *** esbuild ***
  // await installNodeModuleInTempDirAndCopyToCurrent(
  //   "esbuild@0.17.19",
  //   "@esbuild",
  // );
  await downloadEsbuildBinary(target);

  // *** sqlite ***
  await downloadSqliteBinary(target);
  await copySqliteBinary();

  await downloadRipgrepBinary(target);

  // 将 node_modules 复制到 out/node_modules
  await copyNodeModules();

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

    // out 目录（extension.js 所在位置）
    // "out/extension.js", 这是由 vsce 之后生成的
    // web-tree-sitter
    "out/tree-sitter.wasm",
    // jsdom 所需的工作者
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
}

(async () => {
  await package(target, os, arch, exe);
})();