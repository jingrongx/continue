const fs = require("fs");

const directories = [
  // GUI相关目录
  "./gui/node_modules",
  "./gui/out",
  "./gui/dist",
  // 核心模块相关目录
  "./core/node_modules",
  "./core/dist",
  // 扩展/VScode相关目录
  "./extensions/vscode/node_modules",
  "./extensions/vscode/bin",
  "./extensions/vscode/build",
  "./extensions/vscode/out",
  // 二进制相关目录
  "./binary/node_modules",
  "./binary/bin",
  "./binary/dist",
  "./binary/out",
];

// 遍历每个目录
directories.forEach((dir) => {
  // 检查目录是否存在
  if (fs.existsSync(dir)) {
    // 递归删除目录
    fs.rmdirSync(dir, { recursive: true });
    console.log(`已删除 ${dir}`);
  } else {
    console.log(`${dir} 未找到`);
  }
});
