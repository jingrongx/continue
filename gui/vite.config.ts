import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
// 导出默认配置
export default defineConfig({
  plugins: [react(), tailwindcss()], // 使用的插件：React 和 Tailwind CSS
  build: {
    // 更改输出的 .js 文件名，不包含哈希值
    rollupOptions: {
      // external: ["vscode-webview"], // 外部依赖（已注释）
      output: {
        entryFileNames: `assets/[name].js`, // 入口文件名格式
        chunkFileNames: `assets/[name].js`, // 块文件名格式
        assetFileNames: `assets/[name].[ext]`, // 资源文件名格式
      },
    },
  },
});
