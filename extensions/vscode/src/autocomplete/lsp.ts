import type { IDE, Range, RangeInFile } from "core";
import { getAst, getTreePathAtCursor } from "core/autocomplete/ast";
import { GetLspDefinitionsFunction } from "core/autocomplete/completionProvider";
import { AutocompleteLanguageInfo } from "core/autocomplete/languages";
import { AutocompleteSnippet } from "core/autocomplete/ranking";
import { RangeInFileWithContents } from "core/commands/util";
import {
  FUNCTION_BLOCK_NODE_TYPES,
  FUNCTION_DECLARATION_NODE_TYPEs,
} from "core/indexing/chunk/code";
import { intersection } from "core/util/ranges";
import * as vscode from "vscode";
import type Parser from "web-tree-sitter";

type GotoProviderName =
  | "vscode.executeDefinitionProvider"
  | "vscode.executeTypeDefinitionProvider"
  | "vscode.executeDeclarationProvider"
  | "vscode.executeImplementationProvider"
  | "vscode.executeReferenceProvider";

interface GotoInput {
  uri: string;
  line: number;
  character: number;
  name: GotoProviderName;
}
function gotoInputKey(input: GotoInput) {
  return `${input.name}${input.uri.toString}${input.line}${input.character}`;
}

const MAX_CACHE_SIZE = 50;
const gotoCache = new Map<string, RangeInFile[]>();

export async function executeGotoProvider(
  input: GotoInput,
): Promise<RangeInFile[]> {
  const cacheKey = gotoInputKey(input);
  const cached = gotoCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const definitions = (await vscode.commands.executeCommand(
      input.name,
      vscode.Uri.parse(input.uri),
      new vscode.Position(input.line, input.character),
    )) as any;

    const results = definitions
      .filter((d: any) => (d.targetUri || d.uri) && (d.targetRange || d.range))
      .map((d: any) => ({
        filepath: (d.targetUri || d.uri).fsPath,
        range: d.targetRange || d.range,
      }));

    // 添加到缓存
    if (gotoCache.size >= MAX_CACHE_SIZE) {
      // 从缓存中移除最旧的项目
      const oldestKey = gotoCache.keys().next().value;
      if (oldestKey) {
        gotoCache.delete(oldestKey);
      }
    }
    gotoCache.set(cacheKey, results);

    return results;
  } catch (e) {
    console.warn(`执行 ${input.name} 时出错:`, e);
    return [];
  }
}

function isRifWithContents(
  rif: RangeInFile | RangeInFileWithContents,
): rif is RangeInFileWithContents {
  return typeof (rif as any).contents === "string";
}

function findChildren(
  node: Parser.SyntaxNode,
  predicate: (n: Parser.SyntaxNode) => boolean,
  firstN?: number,
): Parser.SyntaxNode[] {
  let matchingNodes: Parser.SyntaxNode[] = [];

  if (firstN && firstN <= 0) {
    return [];
  }

  // 检查当前节点的类型是否在我们感兴趣的类型列表中
  if (predicate(node)) {
    matchingNodes.push(node);
  }

  // 递归搜索当前节点所有子节点中匹配的类型
  for (const child of node.children) {
    matchingNodes = matchingNodes.concat(
      findChildren(
        child,
        predicate,
        firstN ? firstN - matchingNodes.length : undefined,
      ),
    );
  }

  return matchingNodes;
}

function findTypeIdentifiers(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
  return findChildren(
    node,
    (childNode) =>
      childNode.type === "type_identifier" ||
      (["ERROR"].includes(childNode.parent?.type ?? "") &&
        childNode.type === "identifier" &&
        childNode.text[0].toUpperCase() === childNode.text[0]),
  );
}

async function crawlTypes(
  rif: RangeInFile | RangeInFileWithContents,
  ide: IDE,
  depth: number = 1,
  results: RangeInFileWithContents[] = [],
  searchedLabels: Set<string> = new Set(),
): Promise<RangeInFileWithContents[]> {
  // 获取文件内容，如果尚未附加
  const contents = isRifWithContents(rif)
    ? rif.contents
    : await ide.readFile(rif.filepath);

  // 解析 AST
  const ast = await getAst(rif.filepath, contents);
  if (!ast) return results;
  const astLineCount = ast.rootNode.text.split("\n").length;

  // 查找类型标识符
  const identifierNodes = findTypeIdentifiers(ast.rootNode).filter(
    (node) => !searchedLabels.has(node.text),
  );
  // 不要多次搜索相同的类型定义
  // 我们在下面去重以确保，但这可以节省对 LSP 的调用
  identifierNodes.forEach((node) => searchedLabels.add(node.text));

  // 使用 LSP 获取这些类型的定义
  const definitions = await Promise.all(
    identifierNodes.map(async (node) => {
      const [typeDef] = await executeGotoProvider({
        uri: rif.filepath,
        // TODO: tree-sitter 是从零开始索引的，但至少在 .ts 解析器中有一个偏差
        line:
          rif.range.start.line +
          Math.min(node.startPosition.row, astLineCount - 1),
        character: rif.range.start.character + node.startPosition.column,
        name: "vscode.executeDefinitionProvider",
      });

      if (!typeDef) {
        return undefined;
      }
      return {
        ...typeDef,
        contents: await ide.readRangeInFile(typeDef.filepath, typeDef.range),
      };
    }),
  );

  // TODO: 如果不在我们的代码中则过滤掉？

  // 过滤掉重复项
  for (const definition of definitions) {
    if (
      !definition ||
      results.some(
        (result) =>
          result.filepath === definition.filepath &&
          intersection(result.range, definition.range) !== null,
      )
    ) {
      continue; // ;)
    }
    results.push(definition);
  }

  // 递归
  if (depth > 0) {
    for (const result of [...results]) {
      await crawlTypes(result, ide, depth - 1, results, searchedLabels);
    }
  }

  return results;
}

export async function getDefinitionsForNode(
  uri: string,
  node: Parser.SyntaxNode,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
): Promise<RangeInFileWithContents[]> {
  const ranges: (RangeInFile | RangeInFileWithContents)[] = [];
  switch (node.type) {
    case "call_expression": {
      // 函数调用 -> 函数定义
      const [funDef] = await executeGotoProvider({
        uri,
        line: node.startPosition.row,
        character: node.startPosition.column,
        name: "vscode.executeDefinitionProvider",
      });
      if (!funDef) {
        return [];
      }

      // 不显示超过 15 行的函数
      // 我们当然可以在这里做得更聪明
      let funcText = await ide.readRangeInFile(funDef.filepath, funDef.range);
      if (funcText.split("\n").length > 15) {
        let truncated = false;
        const funRootAst = await getAst(funDef.filepath, funcText);
        if (funRootAst) {
          const [funNode] = findChildren(
            funRootAst?.rootNode,
            (node) => FUNCTION_DECLARATION_NODE_TYPEs.includes(node.type),
            1,
          );
          if (funNode) {
            const [statementBlockNode] = findChildren(
              funNode,
              (node) => FUNCTION_BLOCK_NODE_TYPES.includes(node.type),
              1,
            );
            if (statementBlockNode) {
              funcText = funRootAst.rootNode.text
                .slice(0, statementBlockNode.startIndex)
                .trim();
              truncated = true;
            }
          }
        }
        if (!truncated) {
          funcText = funcText.split("\n")[0];
        }
      }

      ranges.push(funDef);

      const typeDefs = await crawlTypes(
        {
          ...funDef,
          contents: funcText,
        },
        ide,
      );
      ranges.push(...typeDefs);
      break;
    }
    case "variable_declarator":
      // 变量赋值 -> 变量定义/类型
      // 出现在声明之后的变量使用
      break;
    case "impl_item":
      // trait 的实现 -> trait 定义
      break;
    case "new_expression":
      // 在 'new MyClass(...)' 中，“MyClass”是 classNameNode
      const classNameNode = node.children.find(
        (child) => child.type === "identifier",
      );
      const [classDef] = await executeGotoProvider({
        uri,
        line: (classNameNode ?? node).endPosition.row,
        character: (classNameNode ?? node).endPosition.column,
        name: "vscode.executeDefinitionProvider",
      });
      if (!classDef) {
        break;
      }
      const contents = await ide.readRangeInFile(
        classDef.filepath,
        classDef.range,
      );

      ranges.push({
        ...classDef,
        contents: `${
          classNameNode?.text
            ? `${lang.singleLineComment} ${classNameNode.text}:\n`
            : ""
        }${contents.trim()}`,
      });

      const definitions = await crawlTypes({ ...classDef, contents }, ide);
      ranges.push(...definitions.filter(Boolean));

      break;
    case "":
      // 函数定义 -> 实现？
      break;
  }
  return await Promise.all(
    ranges.map(async (rif) => {
      // 将 VS Code Range 类型转换为我们的类型
      const range: Range = {
        start: {
          line: rif.range.start.line,
          character: rif.range.start.character,
        },
        end: {
          line: rif.range.end.line,
          character: rif.range.end.character,
        },
      };
      rif.range = range;

      if (!isRifWithContents(rif)) {
        return {
          ...rif,
          contents: await ide.readRangeInFile(rif.filepath, rif.range),
        };
      }
      return rif;
    }),
  );
}

/**
 * 以及路径上不直接的其他内容：
 * - 在上面一行定义的变量
 * ...等等...
 */

export const getDefinitionsFromLsp: GetLspDefinitionsFunction = async (
  filepath: string,
  contents: string,
  cursorIndex: number,
  ide: IDE,
  lang: AutocompleteLanguageInfo,
): Promise<AutocompleteSnippet[]> => {
  try {
    const ast = await getAst(filepath, contents);
    if (!ast) return [];

    const treePath = await getTreePathAtCursor(ast, cursorIndex);
    if (!treePath) return [];

    const results: RangeInFileWithContents[] = [];
    for (const node of treePath.reverse()) {
      const definitions = await getDefinitionsForNode(
        filepath,
        node,
        ide,
        lang,
      );
      results.push(...definitions);
    }

    return results.map((result) => ({
      ...result,
      score: 0.8,
    }));
  } catch (e) {
    console.warn("从 LSP 获取定义时出错: ", e);
    return [];
  }
};