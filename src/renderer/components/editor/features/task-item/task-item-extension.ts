import { parseIndentedBlocks } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { marked } from "marked";
import type { Token, TokenizerAndRendererExtension, Tokens } from "marked";

/**
 * 任务节点（WrispTaskItem）+ marked 桥接。
 *
 * 双链路（与 admonition / metric 卡片块模式一致）：
 * - 读取：全局 marked 单例上的任务行 tokenizer → 桥接 HTML（内存中转，不落盘）
 *   → taskItem.parseHTML 读 data-checked / data-date 属性
 * - 保存：节点 renderMarkdown → `- [ ] 文本` / `- [x] 文本 [[日期]]`
 *
 * 不在扩展上声明 markdownTokenizer：读取链路不经 MarkdownManager 的 marked 实例，
 * 主链路不生效（同 admonition-extension 顶部说明）。
 */

/** 任务行：`- [ ] 文本` / `* [x] 文本`（缩进表达嵌套层级） */
const taskItemLineRe = /^(\s*)([-+*])\s+\[([ xX])]\s+(.*)$/;

/** 行尾日期属性：仅严格 YYYY-MM-DD 视为任务日期（wiki 链接不受影响） */
const taskDateAttrRe = /\s*\[\[(\d{4}-\d{2}-\d{2})\]\]\s*$/;

interface WrispTaskItemToken extends Tokens.Generic {
  mainContent: string;
  indentLevel: number;
  checked: boolean;
  date: string;
  text: string;
  tokens: Token[];
  nestedTokens?: Token[];
}

interface WrispTaskListToken extends Tokens.Generic {
  items: WrispTaskItemToken[];
}

/** marked 桥接扩展：任务行 → 桥接 HTML（结构与官方 renderHTML 对齐） */
const taskListBridge: TokenizerAndRendererExtension = {
  name: "wrispTaskList",
  level: "block",

  // 段内遇到任务行时提前断段（m 标志跨行匹配行首；≤3 空格缩进，避免命中代码块）
  start(src: string): number {
    const match = /^ {0,3}[-+*][ \t]+\[[ xX]][ \t]+/m.exec(src);
    return match?.index ?? -1;
  },

  tokenizer(src: string): WrispTaskListToken | undefined {
    const lexer = this.lexer;
    if (!lexer) return undefined;

    // 嵌套内容递归解析（与官方 TaskList.markdownTokenizer 同构，增加日期剥离）
    const parseTaskContent = (content: string): Token[] => {
      const nested = parseIndentedBlocks(content, parseConfig, lexer);
      if (nested) {
        const taskListToken: WrispTaskListToken = {
          type: "wrispTaskList",
          raw: nested.raw,
          items: nested.items as WrispTaskItemToken[],
        };
        const remainder = content.slice(nested.raw.length);
        if (remainder.trim()) {
          return [taskListToken, ...lexer.blockTokens(remainder)];
        }
        return [taskListToken];
      }
      return lexer.blockTokens(content);
    };

    const parseConfig = {
      itemPattern: taskItemLineRe,
      extractItemData: (match: RegExpMatchArray) => {
        const rawContent = match[4];
        const dateMatch = taskDateAttrRe.exec(rawContent);
        return {
          indentLevel: match[1].length,
          mainContent: dateMatch ? rawContent.slice(0, dateMatch.index) : rawContent,
          checked: match[3].toLowerCase() === "x",
          date: dateMatch ? dateMatch[1] : "",
        };
      },
      createToken: (
        data: { mainContent: string; checked: boolean; date: string; indentLevel: number },
        nestedTokens?: Token[],
      ): WrispTaskItemToken => ({
        type: "wrispTaskItem",
        raw: "",
        mainContent: data.mainContent,
        indentLevel: data.indentLevel,
        checked: data.checked,
        date: data.date,
        text: data.mainContent,
        tokens: lexer.inlineTokens(data.mainContent),
        nestedTokens,
      }),
      customNestedParser: parseTaskContent,
    };

    const result = parseIndentedBlocks(src, parseConfig, lexer);
    if (!result) return undefined;
    return {
      type: "wrispTaskList",
      raw: result.raw,
      items: result.items as WrispTaskItemToken[],
    };
  },

  renderer(token: Tokens.Generic): string {
    const t = token as WrispTaskListToken;
    // marked 扩展 renderer 的 this 为 Parser 实例（同 admonition 桥接）
    const parser = (this as unknown as {
      parser?: { parse: (tokens: Token[]) => string; parseInline: (tokens: Token[]) => string };
    }).parser;
    if (!parser) return "";

    const items = t.items.map((item) => {
      const attrs = [`data-type="taskItem"`, `data-checked="${item.checked ? "true" : "false"}"`];
      if (item.date) attrs.push(`data-date="${item.date}"`);
      const inline = parser.parseInline(item.tokens ?? []);
      const nested = item.nestedTokens?.length ? parser.parse(item.nestedTokens) : "";
      // checkbox 仅供阅读态（v-html）显示；编辑器解析时 input/label 为未知元素被跳过，
      // 勾选状态由 li 的 data-checked 承载
      const checkbox = `<label><input type="checkbox"${item.checked ? ' checked="checked"' : ""} disabled=""></label>`;
      return `<li ${attrs.join(" ")}>${checkbox}<div><p>${inline}</p>${nested}</div></li>`;
    });
    return `<ul data-type="taskList">${items.join("")}</ul>\n`;
  },
};

/** 是否已注册（幂等保护，模块多次加载时只注册一次） */
let registered = false;

/** 在全局 marked 单例上注册任务行桥接（读取链路使用） */
export function registerTaskItemBridge(): void {
  if (registered) return;
  marked.use({ extensions: [taskListBridge] });
  registered = true;
}

const DATE_ATTR_RE = /^\d{4}-\d{2}-\d{2}$/;

/** date 属性白名单校验：非法格式回退空串（无日期） */
function sanitizeTaskDate(value: unknown): string {
  return typeof value === "string" && DATE_ATTR_RE.test(value) ? value : "";
}

/**
 * 任务节点：基于官方 TaskItem 扩展（保留键盘行为/输入规则/节点名 taskItem）。
 * 新增 date 属性（YYYY-MM-DD）：序列化为行尾 [[日期]]，编辑态由 NodeView chip 渲染。
 * 后续 Task 在此基础上追加 renderMarkdown 与 Vue NodeView。
 */
export const WrispTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // 任务日期（YYYY-MM-DD）：空串表示无日期
      date: {
        default: "",
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => sanitizeTaskDate(element.getAttribute("data-date")),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-date": sanitizeTaskDate(attributes.date) || null,
        }),
      },
    };
  },
});
