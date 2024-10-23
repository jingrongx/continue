---
library_name: "transformers.js"
---

https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 使用 ONNX 权重以兼容 Transformers.js。

## 使用方法 (Transformers.js)

如果你还没有安装，可以从 [NPM](https://www.npmjs.com/package/@xenova/transformers) 安装 [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript 库，使用以下命令：
```bash
npm i @xenova/transformers
```

然后你可以像这样使用模型来计算嵌入：

```js
import { pipeline } from '@xenova/transformers';

// 创建一个特征提取管道
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

// 计算句子嵌入
const sentences = ['This is an example sentence', 'Each sentence is converted'];
const output = await extractor(sentences, { pooling: 'mean', normalize: true });
console.log(output);
// Tensor {
//   dims: [ 2, 384 ],
//   type: 'float32',
//   data: Float32Array(768) [ 0.04592696577310562, 0.07328180968761444, ... ],
//   size: 768
// }
```

你可以使用 `.tolist()` 将这个 Tensor 转换为嵌套的 JavaScript 数组：
```js
console.log(output.tolist());
// [
//   [ 0.04592696577310562, 0.07328180968761444, 0.05400655046105385, ... ],
//   [ 0.08188057690858841, 0.10760223120450974, -0.013241755776107311, ... ]
// ]
```

注意：为 ONNX 权重创建单独的仓库是为了在 WebML 获得更多关注之前的临时解决方案。如果你想让你的模型适合网络使用，我们建议使用 [🤗 Optimum](https://huggingface.co/docs/optimum/index) 转换为 ONNX，并像这个仓库一样构建你的仓库（将 ONNX 权重放在名为 `onnx` 的子文件夹中）。