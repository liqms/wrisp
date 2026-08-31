import { marked } from "marked";
import type { TokenizerAndRendererExtension, Tokens } from "marked";
import type { WrispBlockDefinition } from "../registry";
import { parseFence, sanitizeAttrs, escapeHtmlAttr, kebabCase } from "./md-codec";

/**
 * marked 桥接层：将 `:::name` 约定语法转为桥接 HTML（仅存在于内存解析管线，不落盘）。
 * 依赖现有读取链路（marked.parse → HTML → setContent）与插入链路（insertMarkdownTemplate），
 * 无需改动任何调用方。
 *
 * 说明：
 * - tokenizer 消费"一段连续的围栏"为一个组 token（同列表紧邻归组规则，空行即组边界）
 * - start 回调让 marked 在段落内部遇到 `:::name` 时提前断段
 * - 不在 Tiptap 扩展上声明 markdownTokenizer，避免 MarkdownManager 二次注册无 renderer 的裸 tokenizer
 */

/** 单张卡片的桥接 HTML：`<div data-wrisp-block="..." data-f-*="..."></div>` */
function renderCardBridge(def: WrispBlockDefinition, raw: Record<string, string>): string {
  const attrs = sanitizeAttrs(raw, def.fields);
  const dataAttrs = def.fields
    .map((field) => `data-f-${kebabCase(field.key)}="${escapeHtmlAttr(attrs[field.key])}"`)
    .join(" ");
  return `<div data-wrisp-block="${def.type}" ${dataAttrs}></div>`;
}

/** 由块定义构建 marked 块级扩展（tokenizer + renderer） */
function buildAtomBridge(def: WrispBlockDefinition): TokenizerAndRendererExtension {
  const tokenName = `wrispBlock_${def.type}`;
  const openLineRe = new RegExp(`^:::${def.mdName}[ \\t]*$`);

  return {
    name: tokenName,
    level: "block",
    start: (src: string) => src.indexOf(`:::${def.mdName}`),
    tokenizer(src: string): Tokens.Generic | undefined {
      const lines = src.split("\n");
      if (!openLineRe.test(lines[0])) return undefined;

      const cards: Array<Record<string, string>> = [];
      let lastEndLine = 0;
      let i = 0;
      while (i < lines.length && openLineRe.test(lines[i])) {
        const parsed = parseFence(lines, i);
        if (!parsed) return undefined; // 未闭合围栏：交回 marked 按普通段落降级
        cards.push(parsed.fields);
        lastEndLine = parsed.endLine;
        i = parsed.endLine + 1;
        // 跳过空行继续归组：同类围栏总是排入同一 flex 容器，
        // 行内换行由布局自动完成（每行最多 3 张），空行不作为组边界
        while (i < lines.length && lines[i].trim() === "") i++;
      }

      const raw = lines.slice(0, lastEndLine + 1).join("\n");
      const token: Tokens.Generic & { cards: Array<Record<string, string>> } = {
        type: tokenName,
        raw,
        cards,
      };
      return token;
    },
    renderer(token: Tokens.Generic): string | false {
      const cards = (token as Tokens.Generic & { cards?: Array<Record<string, string>> }).cards ?? [];
      if (!cards.length) return false;
      const cardHtml = cards.map((card) => renderCardBridge(def, card)).join("\n");
      const html = def.groupView
        ? `<div data-wrisp-block-group="${def.type}">\n${cardHtml}\n</div>`
        : cardHtml;
      return `${html}\n`;
    },
  };
}

/** 是否已注册（幂等保护，模块多次加载时只注册一次） */
let registered = false;

/** 在全局 marked 单例上注册所有数据型块的桥接扩展 */
export function registerWrispBlockBridge(definitions: WrispBlockDefinition[]): void {
  if (registered) return;
  const extensions = definitions.map(buildAtomBridge);
  if (extensions.length === 0) return;
  marked.use({ extensions });
  registered = true;
}
