import { Node, mergeAttributes } from "@tiptap/core";
import { marked } from "marked";
import type { Token, TokenizerAndRendererExtension, Tokens } from "marked";

/**
 * Admonition（提示块）：Obsidian 风格 `:::type ... :::` 围栏容器。
 *
 * 双链路（与 metric 卡片块的桥接模式一致）：
 * - 读取：全局 marked 单例上的围栏 tokenizer → 桥接 HTML（内存中转，不落盘）→ parseHTML
 * - 保存：节点 renderMarkdown → `:::type` 围栏（子块用 "\n\n" 连接，同官方 Document 节点）
 *
 * 不在扩展上声明 markdownTokenizer：读取链路不经 MarkdownManager 的 marked 实例，
 * 主链路不生效（见 marked-bridge 顶部说明）。
 */

/** 支持的类型（白名单） */
export const ADMONITION_TYPES = ["note", "tip", "info", "warning", "danger"] as const;
export type AdmonitionType = (typeof ADMONITION_TYPES)[number];

/** 类型白名单校验：非法值回退 note */
function sanitizeAdmonitionType(value: unknown): AdmonitionType {
  return typeof value === "string" && (ADMONITION_TYPES as readonly string[]).includes(value)
    ? (value as AdmonitionType)
    : "note";
}

/** 开行：`:::note` / `:::warning` 等（仅白名单类型才构成 admonition） */
const openLineRe = new RegExp(`^:::(${ADMONITION_TYPES.join("|")})[ \\t]*$`);
/** 任意具名开行（`:::\w+`）：嵌套计数时视为一层围栏开启（含 metric 等其他 `:::` 约定块） */
const openAnyNameRe = /^:::[A-Za-z0-9_-]+[ \t]*$/;
/** 闭行：裸 `:::` */
const closeLineRe = /^:::[ \t]*$/;

/** marked 桥接扩展：围栏 → 桥接 HTML */
const admonitionBridge: TokenizerAndRendererExtension = {
  name: "wrispAdmonition",
  level: "block",

  // 段内遇到围栏开行时提前断段（与 metric 桥接一致；仅匹配完整开行，避免误吞段落）
  start(src: string): number {
    let best = -1;
    for (const type of ADMONITION_TYPES) {
      const match = new RegExp(`^:::${type}[ \\t]*$`, "m").exec(src);
      if (match && (best < 0 || match.index < best)) best = match.index;
    }
    return best;
  },

  tokenizer(src: string): Tokens.Generic | undefined {
    const lines = src.split("\n");
    const open = openLineRe.exec(lines[0]);
    if (!open) return undefined;

    // 嵌套计数：任何具名开行 +1、裸 `:::` -1，
    // 同时正确处理嵌套 admonition 与内部 metric 围栏的闭合归属
    let depth = 1;
    let endLine = -1;
    for (let i = 1; i < lines.length; i++) {
      if (openAnyNameRe.test(lines[i])) depth += 1;
      else if (closeLineRe.test(lines[i])) {
        depth -= 1;
        if (depth === 0) {
          endLine = i;
          break;
        }
      }
    }
    // 未闭合围栏：交回 marked 按普通段落降级（不丢失内容）
    if (endLine < 0) return undefined;

    const inner = lines.slice(1, endLine).join("\n");
    const token: Tokens.Generic & { admonitionType: string } = {
      type: "wrispAdmonition",
      raw: lines.slice(0, endLine + 1).join("\n"),
      admonitionType: open[1],
      text: inner,
      // 内部内容递归解析为块级 token（列表/标题/嵌套围栏等）
      tokens: this.lexer.blockTokens(inner),
    };
    return token;
  },

  renderer(token: Tokens.Generic): string | false {
    const t = token as Tokens.Generic & { admonitionType?: string };
    const type = sanitizeAdmonitionType(t.admonitionType);
    // marked 扩展 renderer 的 this 为 Parser 实例，负责把块级 token 渲染为 HTML
    const parser = (this as unknown as { parser?: { parse: (tokens: Token[]) => string } }).parser;
    const inner = parser ? parser.parse((t.tokens ?? []) as Token[]) : t.text ?? "";
    return `<div data-admonition="" data-type="${type}">${inner}</div>\n`;
  },
};

/** 是否已注册（幂等保护，模块多次加载时只注册一次） */
let registered = false;

/** 在全局 marked 单例上注册 admonition 围栏桥接（读取链路使用） */
export function registerAdmonitionBridge(): void {
  if (registered) return;
  marked.use({ extensions: [admonitionBridge] });
  registered = true;
}

/** Admonition Tiptap 节点：容器块，可包裹任意块级内容 */
export const Admonition = Node.create({
  name: "admonition",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "note" as AdmonitionType,
        parseHTML: (element: HTMLElement) => sanitizeAdmonitionType(element.getAttribute("data-type")),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-type": sanitizeAdmonitionType(attributes.type),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-admonition]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-admonition": "" }, HTMLAttributes), 0];
  },

  renderMarkdown(node, helpers) {
    const type = sanitizeAdmonitionType(node.attrs?.type);
    const inner = node.content ? helpers.renderChildren(node.content, "\n\n") : "";
    return `:::${type}\n\n${inner}\n\n:::\n\n`;
  },
});
