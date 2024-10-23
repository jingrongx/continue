import * as esbuild from "esbuild";
import glob from "glob";

/**
 * 将测试打包成多个文件，然后使用 runTestOnVSCodeHost 通过 node runTestOnVSCodeHost.js 运行
 * 它会下载 vscode，启动它并传递测试文件以运行 - mochaRunner.js
 * mochaRunner.js 然后使用 Mocha 类运行测试
 */

console.log("正在打包测试...");

// 打包脚本以在 VSCode 主机上运行测试 + 将从 VSCode 主机内调用的 mocha 运行器
await esbuild.build({
  entryPoints: [
    // 使用 @vscode/test-electron 的 runTests 在 VSCode 主机上运行 mocha 运行器
    "src/test/runner/runTestOnVSCodeHost.ts",

    // 使用 Mocha 类运行打包的测试
    "src/test/runner/mochaRunner.ts",
  ],
  bundle: true,
  outdir: "out",

  external: [
    "vscode",

    // 将 mocha 外部化很重要，否则在运行测试时 mocha 似乎没有正确初始化
    // 例如，当 mocha 没有外部化时，esbuild 的警告：
    // [WARNING] "./reporters/parallel-buffered" 应该被标记为外部以便与 "require.resolve" 一起使用 [require-resolve-not-external]
    "mocha",
  ],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },
});

/**
 * 注意：打包是为了绕过导入问题，例如 fkill 不提供 cjs 模块。
 * 而不是找出一个可行的 tsconfig.json 组合，我决定打包测试。
 */
await esbuild.build({
  // 测试可以添加到 src 文件夹中的任何位置
  entryPoints: glob.sync("src/**/*.test.ts"),
  bundle: true,
  outdir: "out",
  external: [
    "vscode",

    // 将 mocha 外部化很重要，否则在运行测试时 mocha 似乎没有正确初始化
    "mocha",
  ],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  loader: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".node": "file",
  },
  // 允许 transformers.js 使用 import.meta.path
  // https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
  inject: ["./scripts/importMetaUrl.js"],
  define: { "import.meta.url": "importMetaUrl" },
});