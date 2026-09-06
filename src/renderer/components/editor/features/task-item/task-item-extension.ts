import { parseIndentedBlocks } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import { marked } from "marked";
import TaskItemView from "./TaskItemView.vue";
import type { Token, TokenizerAndRendererExtension, Tokens } from "marked";

/**
 * 任务节点（WrispTaskItem）+ marked 桥接。
 *
 * 双链路（与 admonition / metric 卡片块模式一致）：
 * - 读取：全局 marked 单例上的任务行 tokenizer → 桥接 HTML（内存中转，不落盘）
 *   → taskItem.parseHTML 读 data-checked 属性
 * - 保存：官方 renderMarkdown → `- [ ] 文本` / `- [x] 文本`
 *
 * 日期为非必要信息：不设专属属性，`[[日期]]` 与正文统一——
 * 在任务里用斜杠命令（日期和时间组）插入 `[[YYYY-MM-DD]]` 行内文本，
 * 编辑态由 inline-sem Decoration 渲染药丸，序列化随普通文本转义（幂等）。
 *
 * 不在扩展上声明 markdownTokenizer：读取链路不经 MarkdownManager 的 marked 实例，
 * 主链路不生效（同 admonition-extension 顶部说明）。
 */

/** 任务行：`- [ ] 文本` / `* [x] 文本`（缩进表达嵌套层级） */
const taskItemLineRe = /^(\s*)([-+*])\s+\[([ xX])]\s+(.*)$/;

interface WrispTaskItemToken extends Tokens.Generic {
  mainContent: string;
  indentLevel: number;
  checked: boolean;
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

    // 嵌套内容递归解析（与官方 TaskList.markdownTokenizer 同构）
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
        return {
          indentLevel: match[1].length,
          mainContent: rawContent,
          checked: match[3].toLowerCase() === "x",
        };
      },
      createToken: (
        data: { mainContent: string; checked: boolean; indentLevel: number },
        nestedTokens?: Token[],
      ): WrispTaskItemToken => ({
        type: "wrispTaskItem",
        raw: "",
        mainContent: data.mainContent,
        indentLevel: data.indentLevel,
        checked: data.checked,
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

/**
 * 任务节点：基于官方 TaskItem 扩展（保留键盘行为/输入规则/节点名 taskItem）。
 * 编辑态 Vue NodeView 渲染勾选框（title 提示 + change 切换），
 * 交互区经 stopEvent/ignoreMutation 与 ProseMirror 隔离。
 */
export const WrispTaskItem = TaskItem.extend({
  // 编辑态 NodeView：勾选框切换（日期等行内内容由统一机制处理）
  addNodeView() {
    return VueNodeViewRenderer(TaskItemView, {
      // 勾选框的交互交给 Vue：
      // 阻止 ProseMirror 抢焦点或把点击当作编辑器选区操作
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return Boolean(target?.closest?.(".task-item-checkbox"));
      },
      // 勾选框 DOM 由 Vue 管理，其内变更必须忽略；
      // 内容区（.task-item-text）与选区变化交给 ProseMirror（同 admonition 模式）
      ignoreMutation: ({ mutation }) => {
        const target = mutation.target;
        const el = target instanceof Element ? target : (target?.parentElement ?? null);
        if (!el) return true;
        if (mutation.type === "selection") return false;
        return !el.closest(".task-item-text");
      },
    });
  },
});
