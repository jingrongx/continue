import cors from "cors";
import express from "express";
import { http, https } from "follow-redirects";

const PROXY_PORT = 65433;
const app = express();
app.use(cors());

app.use((req, res, next) => {
  // 代理请求
  const { origin, host, ...headers } = req.headers;
  const url = req.headers["x-continue-url"] as string;
  const parsedUrl = new URL(url);
  const protocolString = url.split("://")[0];
  const protocol = protocolString === "https" ? https : http;
  const proxy = protocol.request(url, {
    method: req.method,
    headers: {
      ...headers,
      host: parsedUrl.host,
    },
  });

  proxy.on("response", (response) => {
    res.status(response.statusCode || 500);
    for (let i = 1; i < response.rawHeaders.length; i += 2) {
      if (
        response.rawHeaders[i - 1].toLowerCase() ===
        "access-control-allow-origin"
      ) {
        continue;
      }
      res.setHeader(response.rawHeaders[i - 1], response.rawHeaders[i]);
    }
    response.pipe(res);
  });

  proxy.on("error", (error) => {
    console.error(error);
    res.sendStatus(500);
  });

  req.pipe(proxy);
});

// http-middleware-proxy
// app.use("/", (req, res, next) => {
//   // 从请求URL中提取目标
//   const target = req.headers["x-continue-url"] as string;
//   const { origin, ...headers } = req.headers;

//   // 为此请求创建一个新的代理中间件
//   const proxy = createProxyMiddleware({
//     target,
//     ws: true,
//     headers: {
//       origin: "",
//     },
//   });

//   // 调用中间件
//   proxy(req, res, next);
// });

export function startProxy() {
  const server = app.listen(PROXY_PORT, () => {
    console.log(`代理服务器正在端口 ${PROXY_PORT} 上运行`);
  });
  server.on("error", (e) => {
    // console.log("代理服务器已在端口 65433 上运行");
  });
}