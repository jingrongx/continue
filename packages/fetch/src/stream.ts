export async function* toAsyncIterable(
  nodeReadable: NodeJS.ReadableStream,
): AsyncGenerator<Uint8Array> {
  // 遍历 Node.js 可读流的每个块
  for await (const chunk of nodeReadable) {
    // 将块作为 Uint8Array 产出
    yield chunk as Uint8Array;
  }
}

export async function* streamResponse(
  response: Response,
): AsyncGenerator<string> {
  // 检查响应状态码是否为 200
  if (response.status !== 200) {
    // 如果不是，抛出错误并返回响应文本
    throw new Error(await response.text());
  }

  // 检查响应是否有主体
  if (!response.body) {
    throw new Error("No response body returned.");
  }

  // 获取 Node.js 的主版本号
  const nodeMajorVersion = parseInt(process.versions.node.split(".")[0], 10);

  if (nodeMajorVersion >= 20) {
    // 对于 Node 20 及以上版本，使用新的 API
    const stream = (ReadableStream as any).from(response.body);
    for await (const chunk of stream.pipeThrough(
      new TextDecoderStream("utf-8"),
    )) {
      yield chunk;
    }
  } else {
    // 对于 Node 20 以下版本的回退方案
    // 使用这种方法进行流式传输不如 20+ 版本
    const decoder = new TextDecoder("utf-8");
    const nodeStream = response.body as unknown as NodeJS.ReadableStream;
    for await (const chunk of toAsyncIterable(nodeStream)) {
      yield decoder.decode(chunk, { stream: true });
    }
  }
}

function parseDataLine(line: string): any {
  // 解析以 "data: " 开头的行
  const json = line.startsWith("data: ")
    ? line.slice("data: ".length)
    : line.slice("data:".length);

  try {
    // 尝试解析 JSON 数据
    const data = JSON.parse(json);
    if (data.error) {
      throw new Error(`Error streaming response: ${data.error}`);
    }

    return data;
  } catch (e) {
    throw new Error(`Malformed JSON sent from server: ${json}`);
  }
}

function parseSseLine(line: string): { done: boolean; data: any } {
  // 解析 SSE 行
  if (line.startsWith("data: [DONE]")) {
    return { done: true, data: undefined };
  }
  if (line.startsWith("data:")) {
    return { done: false, data: parseDataLine(line) };
  }
  if (line.startsWith(": ping")) {
    return { done: true, data: undefined };
  }
  return { done: false, data: undefined };
}

export async function* streamSse(response: Response): AsyncGenerator<any> {
  let buffer = "";
  for await (const value of streamResponse(response)) {
    buffer += value;

    let position: number;
    while ((position = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, position);
      buffer = buffer.slice(position + 1);

      const { done, data } = parseSseLine(line);
      if (done) {
        break;
      }
      if (data) {
        yield data;
      }
    }
  }

  if (buffer.length > 0) {
    const { done, data } = parseSseLine(buffer);
    if (!done && data) {
      yield data;
    }
  }
}

export async function* streamJSON(response: Response): AsyncGenerator<any> {
  let buffer = "";
  for await (const value of streamResponse(response)) {
    buffer += value;

    let position;
    while ((position = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, position);
      const data = JSON.parse(line);
      yield data;
      buffer = buffer.slice(position + 1);
    }
  }
}
