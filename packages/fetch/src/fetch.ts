import { RequestOptions } from "@continuedev/config-types/src/index.js";
import * as followRedirects from "follow-redirects";
import { HttpProxyAgent } from "http-proxy-agent";
import { globalAgent } from "https";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch, { RequestInit, Response } from "node-fetch";
import * as fs from "node:fs";
import tls from "node:tls";

const { http, https } = (followRedirects as any).default;

export function fetchwithRequestOptions(
  url_: URL | string,
  init?: RequestInit,
  requestOptions?: RequestOptions,
): Promise<Response> {
  let url = url_;
  if (typeof url === "string") {
    url = new URL(url);
  }

  const TIMEOUT = 7200; // 超时时间为7200秒，即2小时

  let globalCerts: string[] = [];
  if (process.env.IS_BINARY) {
    if (Array.isArray(globalAgent.options.ca)) {
      globalCerts = [...globalAgent.options.ca.map((cert) => cert.toString())];
    } else if (typeof globalAgent.options.ca !== "undefined") {
      globalCerts.push(globalAgent.options.ca.toString());
    }
  }
  const ca = Array.from(new Set([...tls.rootCertificates, ...globalCerts]));
  const customCerts =
    typeof requestOptions?.caBundlePath === "string"
      ? [requestOptions?.caBundlePath]
      : requestOptions?.caBundlePath;
  if (customCerts) {
    ca.push(
      ...customCerts.map((customCert) => fs.readFileSync(customCert, "utf8")),
    );
  }

  const timeout = (requestOptions?.timeout ?? TIMEOUT) * 1000; // 超时时间以毫秒为单位

  const agentOptions: { [key: string]: any } = {
    ca,
    rejectUnauthorized: requestOptions?.verifySsl,
    timeout,
    sessionTimeout: timeout,
    keepAlive: true,
    keepAliveMsecs: timeout,
  };

  // 处理客户端证书选项
  if (requestOptions?.clientCertificate) {
    agentOptions.cert = fs.readFileSync(
      requestOptions.clientCertificate.cert,
      "utf8",
    );
    agentOptions.key = fs.readFileSync(
      requestOptions.clientCertificate.key,
      "utf8",
    );
    if (requestOptions.clientCertificate.passphrase) {
      agentOptions.passphrase = requestOptions.clientCertificate.passphrase;
    }
  }

  const proxy = requestOptions?.proxy;

  // 创建代理
  const protocol = url.protocol === "https:" ? https : http;
  const agent =
    proxy && !requestOptions?.noProxy?.includes(url.hostname)
      ? protocol === https
        ? new HttpsProxyAgent(proxy, agentOptions)
        : new HttpProxyAgent(proxy, agentOptions)
      : new protocol.Agent(agentOptions);

  let headers: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(init?.headers || {})) {
    headers[key] = value as string;
  }
  headers = {
    ...headers,
    ...requestOptions?.headers,
  };

  // 将localhost替换为127.0.0.1
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }

  // 如果提供了额外的body属性，则添加
  let updatedBody: string | undefined = undefined;
  try {
    if (requestOptions?.extraBodyProperties && typeof init?.body === "string") {
      const parsedBody = JSON.parse(init.body);
      updatedBody = JSON.stringify({
        ...parsedBody,
        ...requestOptions.extraBodyProperties,
      });
    }
  } catch (e) {
    console.log("无法解析HTTP请求体: ", e);
  }

  // 使用提供的选项发起请求
  const resp = fetch(url, {
    ...init,
    body: updatedBody ?? init?.body,
    headers: headers,
    agent: agent,
  });

  return resp;
}
