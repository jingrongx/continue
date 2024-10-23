// 确保奇数版本不会发布到主版本。这将不可逆地导致我们将次版本号增加2
const fs = require("fs");

const packageJson = fs.readFileSync("package.json");
const packageJsonJson = JSON.parse(packageJson);
const version = packageJsonJson.version;
const minor = parseInt(version.split(".")[1]);
if (minor % 2 !== 0) {
  throw new Error(
    "不要将奇数版本发布到主 VS Code 版本！"
  );
}