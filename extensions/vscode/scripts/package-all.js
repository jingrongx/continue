const { execSync } = require("child_process");

// 定义支持的平台
const PLATFORMS = [
  "win32-x64",
//   "win32-arm64", 由于没有 sqlite3 二进制文件，无法构建
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
]
const args = process.argv.slice(2);
const isPreRelease = args.includes("--pre-release");

// 异步立即执行函数
(async () => {
  for (const i in PLATFORMS) {
    const platform = PLATFORMS[i];
    const pkgCommand = isPreRelease
      ? "node scripts/package.js --pre-release --target " + platform // --yarn"
      : "node scripts/package.js --target " + platform; // --yarn";

    // 执行预打包脚本
    execSync(
      "node scripts/prepackage-cross-platform.js --target "+ platform,
      {stdio: 'inherit'}
    );

    // 执行打包命令
    execSync(
      pkgCommand,
      {stdio: 'inherit'}
    );
  }
})();