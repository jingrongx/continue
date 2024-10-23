/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // 请注意，这些断点主要是为输入工具栏优化的
    screens: {
      xxs: "170px", // VS Code中主侧边栏的最小宽度
      xs: "250px", // VS Code中平均默认侧边栏宽度
      sm: "330px",
      md: "460px",
      lg: "590px",
      xl: "720px",
    },
    extend: {
      animation: {
        "spin-slow": "spin 10s linear infinite", // 慢速旋转动画
      },
      colors: {
        "vsc-background": "rgb(var(--vsc-background) / <alpha-value>)", // VS Code背景色
        "secondary-dark": "rgb(var(--secondary-dark) / <alpha-value>)", // 次要深色
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // 禁用预设样式
  },
};
