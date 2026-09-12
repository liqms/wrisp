# 自定义任务节点（代办事项）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## 执行状态（2026-09-06，子代理驱动）

- Task 1 ✅ commit `bfc93f7`（桥接；偏离：extractItemData 参数类型 RegExpExecArray→RegExpMatchArray，BlockParserConfig 要求）
- Task 2 ✅ commit `4e48685`（WrispTaskItem 节点；官方 checked parseHTML 已读 data-checked，无需补）
- Task 3 ✅ commit `8cec292` + 审查补充 `162b454`（偏离：appendDateSuffix 注入 text 节点会被 MarkdownManager escapeMarkdownSyntax 转义 `[[` 为 `\[\[`，改为渲染字符串层面拼接，嵌套子块逻辑与官方 renderNestedMarkdownContent 同构；补充嵌套+日期 round-trip 用例）
- Task 4 ✅ commit `a8df09a`（NodeView；无偏离）
- Task 5 ✅ commit `168635a`（接入 + 样式；无偏离）
- Task 6 ✅ 自动回归通过（相关单测全绿 355/355 + typecheck + lint）；41 个 DB 集成用例失败为 better-sqlite3 ABI 环境问题（Electron 145 vs Node 137，dev 实例锁文件），先于本分支存在，与本功能无关。手动验收与推送 PR 待用户执行。
- 用户反馈迭代 ✅ commit `b1a0281`：日期渲染由按钮样式 chip 改为 `[[YYYY-MM-DD]]` 药丸（复用 inline-sem 双链视觉，括号弱化 span + hover 主色高亮）；移除独立"添加日期"按钮，改为悬浮任务行时显示的弱占位药丸 `[[日期]]`（点击添加）；修正 TASK_ITEM i18n 键嵌套（SLASH → EDITOR 层级，补充 DATE_LABEL）；阅读态 marked v-html 经 `li[data-date]::after` 同款药丸展示。单测 28/28 绿 + typecheck + lint 通过。
- 用户反馈迭代2 ✅ commit `0ac5862`：日期改为非必要信息，彻底移除任务专属 date 属性/NodeView 药丸/renderMarkdown 序列化覆写/桥接日期剥离。任务里日期统一用日期斜杠命令插入 `[[YYYY-MM-DD]]` 行内文本（斜杠菜单全局 keydown 触发，任务内天然可用），由 inline-sem Decoration 统一渲染药丸；序列化随普通文本默认转义（`\[\[...\]\]`，与段落日期一致，round-trip 幂等）。旧文档行尾 `[[日期]]` 读取时保留为文本。单测 23/23 绿 + typecheck + lint 通过。

**Goal:** 将代办事项改造为自定义 Tiptap 节点 `WrispTaskItem`（基于官方 TaskItem 扩展），Markdown 标识符保持 `- [ ]` / `- [x]`，新增 `date` 日期属性（序列化为行尾 `[[YYYY-MM-DD]]`，点击 chip 复用 `pickDate()` 日期浮层选择），点击勾选框切换完成状态。

**Architecture:** 双链路桥接（与 admonition 模式一致）：读链路在全局 marked 单例注册块级 tokenizer，把 `- [ ]/- [x] 文本 [[日期]]` 解析为桥接 HTML（`li[data-type="taskItem"][data-checked][data-date]`）再由 `parseHTML` 读入；写链路覆写节点 `renderMarkdown`，把 `date` 属性序列化为行尾 `[[日期]]`。编辑态用 Vue NodeView 渲染勾选框与日期 chip，交互区通过 `stopEvent`/`ignoreMutation` 与 ProseMirror 隔离。**保留官方 `TaskList` 容器与 `taskItem` 节点名**，`toggleTaskList()`/`isActive("taskList")`/`sinkListItem("taskItem")`（气泡菜单）与斜杠命令零改动。

**Tech Stack:** Tiptap v3（`TaskItem.extend` + `@tiptap/vue-3` VueNodeViewRenderer）、marked v18 扩展（`TokenizerAndRendererExtension`）、`@tiptap/core` 的 `parseIndentedBlocks`/`renderNestedMarkdownContent`（官方扩展同款工具，直接复用）、Vue 3 `<script setup>`、Naive UI（NIcon）、Vitest + happy-dom。

**关键前置结论（调研已验证）：**

1. 当前读链路（`mdToHtml` → 全局 marked → `setContent`）**无法还原任务列表**：marked 原生输出 `<li><input disabled>` 不带 `data-type`，官方 TaskList 的 `markdownTokenizer` 只注册到 `@tiptap/markdown` 内部 marked 实例，主链路不经过它。因此必须在全局 marked 上自建桥接（admonition 同款模式）。
2. marked v18 的 `Lexer.blockTokens` **优先执行自定义块级扩展**（已读源码确认），桥接可抢先于原生 list tokenizer 拦截任务行。
3. `parseIndentedBlocks` 与 `renderNestedMarkdownContent` 均从 `@tiptap/core` 公开导出（官方 `@tiptap/extension-list` 同样导入使用，运行时已验证）。
4. `[[...]]` 在文本中会被行内语义 Decoration（wiki 双链）和主进程 token 同步识别。日期必须解析进**节点属性**（NodeView 渲染），不能留在编辑器文本里；存储格式（markdown 文件）中的 `[[2026-09-06]]` 沿用现有行为（与日期斜杠命令插入的 `[[...]]` 一致，不引入新问题）。
5. `renderMarkdown` 的 `node` 参数是 `JSONContent`（`@tiptap/core/dist/index.d.ts:764` 已确认），可在首段末尾追加日期文本节点实现"行尾 [[日期]]"序列化。

**Branch:** `feat/custom-task-node`（基于 dev 新建；dev 分支受保护，最终走 PR）。

**已知限制（接受，不处理）：** 混合列表（普通项在前、任务项在后）中任务项降级为普通文本（官方 tokenizer 同样行为）；松散列表（项间空行）拆分为多个 taskList（内容不丢失，一次循环后稳定）。

---

### Task 1: marked 桥接（读链路：`- [ ]/- [x]` → 桥接 HTML）

**Files:**

- Create: `src/renderer/components/editor/features/task-item/task-item-extension.ts`
- Test: `tests/unit/renderer/task-item-markdown-roundtrip.test.ts`

- [ ] **Step 1: 新建分支**

```bash
git switch -c feat/custom-task-node
```

- [ ] **Step 2: 写失败测试（桥接 HTML 输出）**

创建 `tests/unit/renderer/task-item-markdown-roundtrip.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { marked } from "marked";
import { registerTaskItemBridge } from "@/renderer/components/editor/features/task-item/task-item-extension";

// 模拟应用启动时的桥接注册（幂等）
registerTaskItemBridge();

describe("任务列表 marked 桥接（读链路：- [ ]/- [x] → 桥接 HTML）", () => {
  it("- [ ] 输出 taskList 桥接 HTML，data-checked=false", () => {
    const html = marked.parse("- [ ] 未完成任务") as string;
    expect(html).toContain('<ul data-type="taskList">');
    expect(html).toContain('data-type="taskItem"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain("未完成任务");
  });

  it("- [x] 输出 data-checked=true 且 checkbox 带选中态（阅读态显示）", () => {
    const html = marked.parse("- [x] 已完成任务") as string;
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('checked="checked"');
  });

  it("行尾 [[YYYY-MM-DD]] 提升为 data-date 属性并从文本剥离", () => {
    const html = marked.parse("- [x] 完成报告 [[2026-09-06]]") as string;
    expect(html).toContain('data-date="2026-09-06"');
    expect(html).toContain("完成报告");
    expect(html).not.toContain("[[2026-09-06]]");
  });

  it("非日期格式的 [[wiki 链接]] 保留在文本中（不误剥离）", () => {
    const html = marked.parse("- [ ] 阅读 [[项目笔记]]") as string;
    expect(html).not.toContain("data-date");
    expect(html).toContain("[[项目笔记]]");
  });

  it("多项任务逐项输出 li", () => {
    const html = marked.parse("- [ ] A\n- [x] B") as string;
    expect(html).toContain('data-checked="false"');
    expect(html).toContain('data-checked="true"');
    expect((html.match(/<li /g) ?? []).length).toBe(2);
  });

  it("嵌套任务保留层级（嵌套 taskList）", () => {
    const html = marked.parse("- [ ] 父任务\n  - [x] 子任务") as string;
    expect(html).toContain("父任务");
    expect(html).toContain("子任务");
    expect((html.match(/<ul data-type="taskList">/g) ?? []).length).toBe(2);
  });

  it("普通无序列表不受桥接影响", () => {
    const html = marked.parse("- 普通项") as string;
    expect(html).not.toContain('data-type="taskList"');
    expect(html).not.toContain('data-type="taskItem"');
    expect(html).toContain("普通项");
  });

  it("段落后的任务行正确断段（start 钩子）", () => {
    const html = marked.parse("前置段落。\n- [ ] 任务") as string;
    expect(html).toContain("<p>前置段落。</p>");
    expect(html).toContain('data-type="taskItem"');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: FAIL —— 模块 `task-item-extension` 不存在（Failed to resolve import）。

- [ ] **Step 4: 实现桥接**

创建 `src/renderer/components/editor/features/task-item/task-item-extension.ts`：

```ts
import { parseIndentedBlocks } from "@tiptap/core";
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
      extractItemData: (match: RegExpExecArray) => {
        const rawContent = match[4];
        const dateMatch = taskDateAttrRe.exec(rawContent);
        return {
          indentLevel: match[1].length,
          mainContent: dateMatch
            ? rawContent.slice(0, dateMatch.index)
            : rawContent,
          checked: match[3].toLowerCase() === "x",
          date: dateMatch ? dateMatch[1] : "",
        };
      },
      createToken: (
        data: {
          mainContent: string;
          checked: boolean;
          date: string;
          indentLevel: number;
        },
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
    const parser = (
      this as unknown as {
        parser?: {
          parse: (tokens: Token[]) => string;
          parseInline: (tokens: Token[]) => string;
        };
      }
    ).parser;
    if (!parser) return "";

    const items = t.items.map((item) => {
      const attrs = [
        `data-type="taskItem"`,
        `data-checked="${item.checked ? "true" : "false"}"`,
      ];
      if (item.date) attrs.push(`data-date="${item.date}"`);
      const inline = parser.parseInline(item.tokens ?? []);
      const nested = item.nestedTokens?.length
        ? parser.parse(item.nestedTokens)
        : "";
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: PASS（8 个用例全绿）。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/editor/features/task-item/task-item-extension.ts tests/unit/renderer/task-item-markdown-roundtrip.test.ts
git commit -m "feat(editor): add marked bridge for task list markdown parsing"
```

---

### Task 2: WrispTaskItem 节点（date 属性 + parseHTML 白名单）

**Files:**

- Modify: `src/renderer/components/editor/features/task-item/task-item-extension.ts`
- Test: `tests/unit/renderer/task-item-markdown-roundtrip.test.ts`

- [ ] **Step 1: 追加失败测试（编辑器解析）**

在 `tests/unit/renderer/task-item-markdown-roundtrip.test.ts` 顶部追加导入（放在现有 import 之后）：

```ts
import { afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { WrispTaskItem } from "@/renderer/components/editor/features/task-item/task-item-extension";
```

在文件末尾（第一个 describe 之后）追加：

```ts
const editors: Editor[] = [];

function createEditor(): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [
      StarterKit,
      Markdown,
      TaskList,
      WrispTaskItem.configure({ nested: true }),
    ],
  });
  editors.push(editor);
  return editor;
}

/** 复现应用读取链路：md →（marked 桥接）→ HTML → setContent */
function loadMarkdown(editor: Editor, md: string): void {
  const html = marked.parse(md) as string;
  editor.commands.setContent(html);
}

/** 收集文档中所有 taskItem 节点 */
function collectTaskItems(editor: Editor): PMNode[] {
  const nodes: PMNode[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "taskItem") nodes.push(node);
    return true;
  });
  return nodes;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

describe("任务节点解析（桥接 HTML → taskItem 节点）", () => {
  it("- [ ]/- [x] 解析为 taskItem，checked 属性正确", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] 未完成\n- [x] 已完成");
    const items = collectTaskItems(editor);
    expect(items).toHaveLength(2);
    expect(items[0]?.attrs.checked).toBe(false);
    expect(items[1]?.attrs.checked).toBe(true);
  });

  it("行尾日期 → date 属性，文本中不残留 [[...]]", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [x] 完成报告 [[2026-09-06]]");
    const item = collectTaskItems(editor)[0];
    expect(item?.attrs.date).toBe("2026-09-06");
    expect(item?.textContent).toBe("完成报告");
  });

  it("wiki 链接不剥离：date 为空，文本保留 [[...]]", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] 阅读 [[项目笔记]]");
    const item = collectTaskItems(editor)[0];
    expect(item?.attrs.date).toBe("");
    expect(item?.textContent).toBe("阅读 [[项目笔记]]");
  });

  it("桥接 HTML 中非法 data-date 回退空串（白名单）", () => {
    const editor = createEditor();
    editor.commands.setContent(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false" data-date="not-a-date">x</li></ul>',
    );
    expect(collectTaskItems(editor)[0]?.attrs.date).toBe("");
  });

  it("嵌套任务解析为父子 taskItem", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] 父任务\n  - [x] 子任务");
    const items = collectTaskItems(editor);
    expect(items).toHaveLength(2);
    expect(items[0]?.firstChild?.textContent).toBe("父任务");
    expect(items[1]?.attrs.checked).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: FAIL —— `WrispTaskItem` 未导出（模块没有导出的成员）。

- [ ] **Step 3: 实现 WrispTaskItem 节点**

在 `task-item-extension.ts` 顶部追加导入：

```ts
import TaskItem from "@tiptap/extension-task-item";
```

在文件末尾（`registerTaskItemBridge` 之后）追加：

```ts
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
        parseHTML: (element: HTMLElement) =>
          sanitizeTaskDate(element.getAttribute("data-date")),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-date": sanitizeTaskDate(attributes.date) || null,
        }),
      },
    };
  },
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: PASS（13 个用例全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/components/editor/features/task-item/task-item-extension.ts tests/unit/renderer/task-item-markdown-roundtrip.test.ts
git commit -m "feat(editor): add WrispTaskItem node with date attribute"
```

---

### Task 3: renderMarkdown 序列化（date → 行尾 `[[日期]]`）

**Files:**

- Modify: `src/renderer/components/editor/features/task-item/task-item-extension.ts`
- Test: `tests/unit/renderer/task-item-markdown-roundtrip.test.ts`

- [ ] **Step 1: 追加失败测试（序列化）**

在 `tests/unit/renderer/task-item-markdown-roundtrip.test.ts` 末尾追加：

```ts
describe("任务节点序列化（getMarkdown）", () => {
  it("未完成/已完成 → - [ ] / - [x] 前缀", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] A\n- [x] B");
    const out = editor.getMarkdown();
    expect(out).toContain("- [ ] A");
    expect(out).toContain("- [x] B");
  });

  it("日期属性 → 行尾 [[YYYY-MM-DD]]", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [x] 完成报告 [[2026-09-06]]");
    const out = editor.getMarkdown();
    expect(out).toContain("- [x] 完成报告 [[2026-09-06]]");
  });

  it("round-trip 幂等：加载 → 序列化 → 再加载 → 再序列化一致", () => {
    const editor = createEditor();
    const md = "- [ ] A [[2026-09-01]]\n- [x] B";
    loadMarkdown(editor, md);
    const once = editor.getMarkdown();
    loadMarkdown(editor, once);
    expect(editor.getMarkdown()).toBe(once);
  });

  it("切换 checked / 设置 date 后序列化联动（setNodeMarkup 路径，同官方 NodeView 行为）", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] 任务");
    let pos = -1;
    editor.state.doc.descendants((node, p) => {
      if (node.type.name === "taskItem" && pos < 0) pos = p;
      return true;
    });
    expect(pos).toBeGreaterThanOrEqual(0);
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(pos, undefined, {
        checked: true,
        date: "2026-12-31",
      }),
    );
    const out = editor.getMarkdown();
    expect(out).toContain("- [x] 任务 [[2026-12-31]]");
  });

  it("任务内行内格式（加粗）保留", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] **重点**任务");
    const out = editor.getMarkdown();
    expect(out).toContain("**重点**");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: FAIL —— 日期相关用例失败（当前序列化不含 `[[日期]]`；`- [x] 任务 [[2026-12-31]]` 断言不匹配）。

- [ ] **Step 3: 实现 renderMarkdown**

在 `task-item-extension.ts` 顶部追加导入：

```ts
import { renderNestedMarkdownContent } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
```

在 `sanitizeTaskDate` 函数之后追加：

```ts
/**
 * 在首个段落末尾追加日期文本节点（实现"首行行尾 [[日期]]"序列化）。
 * renderMarkdown 的 node 是 JSONContent（@tiptap/core 类型定义），
 * 官方 renderNestedMarkdownContent 渲染首段内容后接嵌套子块，
 * 把日期文本注入首段即可落在行尾。
 */
function appendDateSuffix(node: JSONContent, suffix: string): JSONContent {
  if (!Array.isArray(node.content) || node.content.length === 0) return node;
  const [first, ...rest] = node.content;
  if (first?.type !== "paragraph") return node;
  return {
    ...node,
    content: [
      {
        ...first,
        content: [...(first.content ?? []), { type: "text", text: suffix }],
      },
      ...rest,
    ],
  };
}
```

在 `WrispTaskItem` 的 `TaskItem.extend({...})` 配置中、`addAttributes` 之后追加：

```ts
  // 覆写官方 renderMarkdown（仅输出 - [ ]/- [x]，无日期）：
  // date 属性 → 首行行尾 [[YYYY-MM-DD]]；嵌套子块缩进由官方工具处理
  renderMarkdown(node, helpers) {
    const checkedChar = node.attrs?.checked ? "x" : " ";
    const date = sanitizeTaskDate(node.attrs?.date);
    const target = date ? appendDateSuffix(node, ` [[${date}]]`) : node;
    return renderNestedMarkdownContent(target, helpers, `- [${checkedChar}] `);
  },
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: PASS（18 个用例全绿）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/components/editor/features/task-item/task-item-extension.ts tests/unit/renderer/task-item-markdown-roundtrip.test.ts
git commit -m "feat(editor): serialize task date attribute as trailing [[YYYY-MM-DD]]"
```

---

### Task 4: Vue NodeView（勾选框切换 + 日期 chip 复用 pickDate）

**Files:**

- Create: `src/renderer/components/editor/features/task-item/TaskItemView.vue`
- Modify: `src/renderer/components/editor/features/task-item/task-item-extension.ts`
- Modify: `src/shared/i18n/locales/zhCN.ts`、`src/shared/i18n/locales/enUS.ts`（NodeView 用到的 4 个键）
- Test: `tests/unit/renderer/task-item-nodeview.test.ts`

- [ ] **Step 1: 追加 i18n 键（zhCN/enUS 成对，locale-keys 测试强制一致）**

`src/shared/i18n/locales/zhCN.ts`：在 `EDITOR` 段内、`PLACEHOLDER: "输入命令...",` 之前插入：

```ts
      TASK_ITEM: {
        TOGGLE_CHECKED_TITLE: "切换完成状态",
        ADD_DATE_TITLE: "添加日期",
        CHANGE_DATE_TITLE: "修改日期",
        CLEAR_DATE_TITLE: "清除日期",
      },
```

`src/shared/i18n/locales/enUS.ts`：在 `PLACEHOLDER: "Type a command...",` 之前插入：

```ts
      TASK_ITEM: {
        TOGGLE_CHECKED_TITLE: "Toggle completion",
        ADD_DATE_TITLE: "Add date",
        CHANGE_DATE_TITLE: "Change date",
        CLEAR_DATE_TITLE: "Clear date",
      },
```

- [ ] **Step 2: 写失败测试（NodeView 交互）**

创建 `tests/unit/renderer/task-item-nodeview.test.ts`：

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h } from "vue";
import { Editor, EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import { NMessageProvider } from "naive-ui";
import { naive } from "@/renderer/plugins/naive-ui";
import { pickDate } from "@/renderer/components/editor/slash/commands/datePicker";
import { WrispTaskItem } from "@/renderer/components/editor/features/task-item/task-item-extension";
import zhCNMessages from "@/shared/i18n/locales/zhCN";

// mock 掉日期浮层（真实实现会挂载 NDatePicker 并等待用户交互，单测中不可用）。
// 必须有 vi.mock 工厂调用，vi.mocked() 仅提供类型，不产生 mock。
vi.mock("@/renderer/components/editor/slash/commands/datePicker", () => ({
  pickDate: vi.fn(),
}));

const pickDateMock = vi.mocked(pickDate);

const i18n = createI18n({
  legacy: false,
  locale: "zhCN",
  fallbackLocale: "zhCN",
  messages: { zhCN: zhCNMessages },
  globalInjection: true,
  allowComposition: true,
  missingWarn: false,
  fallbackWarn: false,
});

/**
 * 宿主组件：挂载 EditorContent 以启用 Vue NodeView 上下文
 * （NodeView 经 editor.appContext 继承宿主组件链的 provide/组件注册）。
 */
const Host = defineComponent({
  name: "TaskItemHost",
  components: { EditorContent },
  setup() {
    const editor = useEditor({
      content:
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true" data-date="2026-09-06"><p>完成报告</p></li></ul>',
      extensions: [
        StarterKit,
        TaskList,
        WrispTaskItem.configure({ nested: true }),
      ],
    });
    return { editor };
  },
  render() {
    return h(NMessageProvider, () =>
      h(EditorContent, {
        editor: (this as unknown as { editor?: Editor }).editor ?? undefined,
      }),
    );
  },
});

let wrapper: VueWrapper | null = null;

function getEditor(): Editor {
  return (wrapper!.vm as unknown as { editor: Editor }).editor;
}

function firstTaskItem(): { attrs: Record<string, unknown> } | undefined {
  let found: { attrs: Record<string, unknown> } | undefined;
  getEditor().state.doc.descendants((node) => {
    if (!found && node.type.name === "taskItem") found = node;
    return true;
  });
  return found;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
  pickDateMock.mockReset();
});

describe("任务节点 NodeView", () => {
  it("编辑态渲染勾选框 + 日期 chip + 内容", async () => {
    wrapper = mount(Host, {
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();

    expect(wrapper.find(".task-item-node").exists()).toBe(true);
    const input = wrapper.find(".task-item-checkbox input");
    expect((input.element as HTMLInputElement).checked).toBe(true);
    expect(wrapper.find(".task-item-date").text()).toContain("2026-09-06");
    expect(wrapper.find(".task-item-text").text()).toContain("完成报告");
    // 有日期时不显示添加按钮
    expect(wrapper.find(".task-item-date-add").exists()).toBe(false);
  });

  it("勾选框 change 事件切换完成状态", async () => {
    wrapper = mount(Host, {
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();

    const input = wrapper.find(".task-item-checkbox input");
    (input.element as HTMLInputElement).checked = false;
    await input.trigger("change");
    await flushPromises();
    expect(firstTaskItem()?.attrs.checked).toBe(false);

    (input.element as HTMLInputElement).checked = true;
    await input.trigger("change");
    await flushPromises();
    expect(firstTaskItem()?.attrs.checked).toBe(true);
  });

  it("点击日期 chip 调用 pickDate 并写入返回值", async () => {
    pickDateMock.mockResolvedValue("2026-10-01");
    wrapper = mount(Host, {
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();

    await wrapper.find(".task-item-date").trigger("click");
    await flushPromises();
    expect(pickDateMock).toHaveBeenCalledTimes(1);
    expect(firstTaskItem()?.attrs.date).toBe("2026-10-01");
  });

  it("日期选择取消（空串返回）不修改属性", async () => {
    pickDateMock.mockResolvedValue("");
    wrapper = mount(Host, {
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();

    await wrapper.find(".task-item-date").trigger("click");
    await flushPromises();
    expect(firstTaskItem()?.attrs.date).toBe("2026-09-06");
  });

  it("点击清除按钮清空日期属性并显示添加按钮", async () => {
    wrapper = mount(Host, {
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();

    await wrapper.find(".task-item-date-clear").trigger("click");
    await flushPromises();
    expect(firstTaskItem()?.attrs.date).toBe("");
    expect(wrapper.find(".task-item-date-add").exists()).toBe(true);
  });

  it("无日期任务：点击添加按钮调用 pickDate 并写入", async () => {
    pickDateMock.mockResolvedValue("2026-11-11");
    wrapper = mount(Host, {
      global: { plugins: [i18n, naive, createPinia()] },
    });
    await flushPromises();
    getEditor().commands.setContent(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>普通任务</p></li></ul>',
    );
    await flushPromises();

    await wrapper.find(".task-item-date-add").trigger("click");
    await flushPromises();
    expect(pickDateMock).toHaveBeenCalledTimes(1);
    expect(firstTaskItem()?.attrs.date).toBe("2026-11-11");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run tests/unit/renderer/task-item-nodeview.test.ts`
Expected: FAIL —— `.task-item-node` 等元素不存在（NodeView 未实现，走官方 DOM NodeView）。

- [ ] **Step 4: 实现 TaskItemView.vue**

创建 `src/renderer/components/editor/features/task-item/TaskItemView.vue`：

```vue
<template>
  <NodeViewWrapper as="li" class="task-item-node">
    <!-- 勾选框：mousedown 阻止默认（防编辑器抢焦点，同官方 NodeView），
         change 统一处理鼠标与键盘（Space）两种切换路径 -->
    <label
      class="task-item-checkbox"
      contenteditable="false"
      :title="t('EDITOR.TASK_ITEM.TOGGLE_CHECKED_TITLE')"
      @mousedown.prevent
    >
      <input
        type="checkbox"
        :checked="props.node.attrs.checked"
        @change="onCheckboxChange"
      />
    </label>
    <div class="task-item-body">
      <!-- ProseMirror 内容区（contentDOM） -->
      <NodeViewContent as="div" class="task-item-text" />
      <!-- 日期 chip：点击复用日期斜杠命令的 pickDate 浮层（NDatePicker panel） -->
      <span
        v-if="date"
        class="task-item-date"
        contenteditable="false"
        :title="t('EDITOR.TASK_ITEM.CHANGE_DATE_TITLE')"
        @mousedown.stop.prevent
        @click.stop="openDatePicker"
      >
        <n-icon :size="12"><EventFilled /></n-icon>
        <span class="task-item-date__label">{{ date }}</span>
        <button
          type="button"
          class="task-item-date-clear"
          :title="t('EDITOR.TASK_ITEM.CLEAR_DATE_TITLE')"
          @mousedown.stop.prevent
          @click.stop="clearDate"
        >
          ×
        </button>
      </span>
      <!-- 无日期时的添加按钮（悬浮任务行显示，样式见 _markdown.scss） -->
      <button
        v-else
        type="button"
        class="task-item-date-add"
        contenteditable="false"
        :title="t('EDITOR.TASK_ITEM.ADD_DATE_TITLE')"
        @mousedown.stop.prevent
        @click.stop="openDatePicker"
      >
        <n-icon :size="12"><EventFilled /></n-icon>
      </button>
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { EventFilled } from "@vicons/material";
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import { i18n } from "@/renderer/plugins/i18n";
import { pickDate } from "../../slash/commands/datePicker";

// 与 datePicker.ts 相同的取译法（不依赖组件级 i18n 上下文，NodeView 挂载更稳）
const t = i18n.global.t as (key: string) => string;
const props = defineProps(nodeViewProps);

/** 日期属性（非法格式回退空串 → 不渲染 chip，显示添加按钮） */
const date = computed(() => {
  const v = props.node.attrs.date;
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
});

/** 勾选框 change（鼠标点击 / 键盘 Space 均触发）：切换完成状态 */
function onCheckboxChange(e: Event): void {
  props.updateAttributes({ checked: (e.target as HTMLInputElement).checked });
}

/** 点击日期 chip / 添加按钮：复用斜杠命令的日期浮层，选中后写入属性（取消不动） */
async function openDatePicker(): Promise<void> {
  const pos = props.getPos();
  if (typeof pos !== "number") return;
  const value = await pickDate(props.editor, pos);
  if (value) props.updateAttributes({ date: value });
}

/** 清除日期属性（chip 悬浮的 × 按钮） */
function clearDate(): void {
  props.updateAttributes({ date: "" });
}
</script>
```

- [ ] **Step 5: 在扩展上注册 NodeView**

`task-item-extension.ts` 顶部追加导入：

```ts
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import TaskItemView from "./TaskItemView.vue";
```

在 `WrispTaskItem` 的 `TaskItem.extend({...})` 配置中、`renderMarkdown` 之后追加：

```ts
  // 编辑态 NodeView：勾选框切换 + 日期 chip（点击复用 pickDate 浮层）
  addNodeView() {
    return VueNodeViewRenderer(TaskItemView, {
      // 勾选框 / 日期 chip / 添加按钮的交互交给 Vue：
      // 阻止 ProseMirror 抢焦点或把点击当作编辑器选区操作
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return Boolean(
          target?.closest?.(".task-item-checkbox") ||
            target?.closest?.(".task-item-date") ||
            target?.closest?.(".task-item-date-add"),
        );
      },
      // 勾选框 / chip 区域 DOM 由 Vue 管理，其内变更必须忽略；
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
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm vitest run tests/unit/renderer/task-item-nodeview.test.ts`
Expected: PASS（6 个用例全绿）。

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: PASS（NodeView 替换不影响解析/序列化）。

- [ ] **Step 7: 提交**

```bash
git add src/renderer/components/editor/features/task-item/TaskItemView.vue src/renderer/components/editor/features/task-item/task-item-extension.ts src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts tests/unit/renderer/task-item-nodeview.test.ts
git commit -m "feat(editor): add task item NodeView with checkbox toggle and date chip"
```

---

### Task 5: 接入编辑器（extensions.ts + 样式 + 集成测试）

**Files:**

- Modify: `src/renderer/components/editor/extensions.ts`
- Modify: `src/renderer/styles/_markdown.scss`
- Test: `tests/unit/renderer/task-item-markdown-roundtrip.test.ts`

- [ ] **Step 1: 追加失败测试（getExtensions 全链路）**

在 `tests/unit/renderer/task-item-markdown-roundtrip.test.ts` 顶部追加导入：

```ts
import { Editor as VueEditor } from "@tiptap/vue-3";
import { getExtensions } from "@/renderer/components/editor/extensions";
```

在文件末尾追加：

```ts
describe("编辑器集成（getExtensions 全链路）", () => {
  const integrationEditors: VueEditor[] = [];

  afterEach(() => {
    while (integrationEditors.length) integrationEditors.pop()?.destroy();
  });

  it("getExtensions 注册 WrispTaskItem 且 toggleTaskList 可用（气泡菜单/斜杠命令兼容）", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const editor = new VueEditor({ element: el, extensions: getExtensions() });
    integrationEditors.push(editor);

    editor.commands.setContent("<p>目标</p>");
    editor.commands.setTextSelection(1);
    editor.chain().focus().toggleTaskList().run();
    expect(editor.isActive("taskList")).toBe(true);

    const out = editor.getMarkdown();
    expect(out).toContain("- [ ]");
    expect(out).toContain("目标");
  });

  it("完整链路 round-trip：markdown → 全扩展编辑器 → markdown", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const editor = new VueEditor({ element: el, extensions: getExtensions() });
    integrationEditors.push(editor);

    const html = marked.parse("- [x] 完成报告 [[2026-09-06]]") as string;
    editor.commands.setContent(html);

    let item: PMNode | undefined;
    editor.state.doc.descendants((node) => {
      if (!item && node.type.name === "taskItem") item = node;
      return true;
    });
    expect(item?.attrs.checked).toBe(true);
    expect(item?.attrs.date).toBe("2026-09-06");

    expect(editor.getMarkdown()).toContain("- [x] 完成报告 [[2026-09-06]]");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts`
Expected: FAIL —— getExtensions 仍注册官方 TaskItem（无 date 属性，第二个用例 date 断言失败）。

- [ ] **Step 3: 替换扩展注册**

`src/renderer/components/editor/extensions.ts`：

1. 删除第 7 行 `import TaskItem from "@tiptap/extension-task-item";`
2. 在 admonition 导入之后追加：

```ts
import {
  WrispTaskItem,
  registerTaskItemBridge,
} from "./features/task-item/task-item-extension";
```

3. 在 `registerAdmonitionBridge();`（第 32 行）之后追加：

```ts
// 在全局 marked 单例上注册 `- [ ]/- [x]` 任务行桥接（幂等）
registerTaskItemBridge();
```

4. 将第 91-94 行：

```ts
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
```

替换为：

```ts
    TaskList,
    // 任务项：date 属性 + Vue NodeView（勾选切换 / 日期 chip 复用 pickDate）
    WrispTaskItem.configure({
      nested: true,
    }),
```

（气泡菜单 `BubbleMenu.vue` 的 `toggleTaskList()`/`isActive("taskList")`/`sinkListItem("taskItem")` 与斜杠命令 `basic-task-list` 均无需改动——节点名与命令保持不变。）

- [ ] **Step 4: 追加样式**

`src/renderer/styles/_markdown.scss`：在 `ul[data-type="taskList"] li` 规则块（约第 112-126 行）结束之后、`.task-item` 相关规则之前的位置（即紧跟任务清单注释块之后）插入：

```scss
// ===== 任务节点（WrispTaskItem，Vue NodeView 渲染）=====
// 布局复用上方 ul[data-type="taskList"] li 规则（flex + label/div 子项）：
// li 结构为 label（勾选框）+ div.task-item-body（内容行），chip 紧跟文本行尾
.task-item-node {
  .task-item-body {
    display: flex;
    align-items: flex-start;
    min-width: 0;
  }

  // NodeViewContent：不占满整行（flex-grow 0），让日期 chip 紧跟文本
  .task-item-text {
    flex: 0 1 auto;
    min-width: 0;
  }

  .task-item-date {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
    margin-left: 6px;
    margin-top: 0.1em;
    padding: 1px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--primary-color) 8%, transparent);
    color: var(--text-secondary);
    font-size: 0.85em;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: background-color 0.15s ease;

    &:hover {
      background: color-mix(in srgb, var(--primary-color) 16%, transparent);
      color: var(--primary-color);
    }

    // 清除按钮：chip 内右侧，默认隐藏、chip 悬浮显示
    .task-item-date-clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 2px;
      padding: 0;
      width: 14px;
      height: 14px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.12s ease;

      &:hover {
        background: color-mix(in srgb, var(--primary-color) 20%, transparent);
      }
    }

    &:hover .task-item-date-clear {
      opacity: 0.8;
    }
  }

  // 添加日期按钮：无日期时占位，悬浮任务行显示
  .task-item-date-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    margin-left: 4px;
    margin-top: 0.1em;
    padding: 1px;
    border: none;
    background: transparent;
    color: var(--text-quaternary);
    cursor: pointer;
    visibility: hidden;
    transition: color 0.15s ease;

    &:hover {
      color: var(--primary-color);
    }
  }

  &:hover .task-item-date-add {
    visibility: visible;
  }
}

// 阅读态（marked v-html，无 Vue NodeView）：data-date 属性经 ::after 展示。
// 编辑态 NodeView（.task-item-node）由 Vue chip 渲染，排除避免双显
ul[data-type="taskList"] li[data-date]:not(.task-item-node)::after {
  content: "[[" attr(data-date) "]]";
  margin-left: 6px;
  color: var(--text-secondary);
  font-size: 0.85em;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run tests/unit/renderer/task-item-markdown-roundtrip.test.ts tests/unit/renderer/task-item-nodeview.test.ts`
Expected: PASS（20 + 6 个用例全绿）。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/editor/extensions.ts src/renderer/styles/_markdown.scss tests/unit/renderer/task-item-markdown-roundtrip.test.ts
git commit -m "feat(editor): register WrispTaskItem in editor extensions with chip styles"
```

---

### Task 6: 全量回归 + 手动验收

**Files:** 无新增（只验证与修复）

- [ ] **Step 1: 全量单测**

Run: `pnpm test`
Expected: 全部 PASS。重点关注既有用例是否受桥接影响：

- `tests/unit/renderer/tiptap-editor-page-switch.test.ts`（若 fixture 含 `- [ ]` 行且断言了旧结构（bulletList + input），需按新结构（taskItem）修正断言）
- `tests/unit/renderer/image-nodeview.test.ts`、`blocks/admonition.test.ts`（getExtensions 集成，应不受影响）

- [ ] **Step 2: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。若 `renderMarkdown(node, helpers)` 的上下文类型报错（node 需收窄为 `JSONContent`），把实现改为 `renderMarkdown(node: JSONContent, helpers: Parameters<...>` 的最简修正：直接内联类型断言 `const target = date ? appendDateSuffix(node as JSONContent, ...)`。

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 无错误（`--fix` 自动整理格式）。

- [ ] **Step 4: 手动验收（pnpm dev）**

1. 打开任意页面，斜杠命令插入「待办事项」，输入任务文本。
2. 点击勾选框 → 完成状态切换；`Ctrl+S`（或自动保存）后关闭重开页面，勾选状态保留（修复了旧链路丢状态的问题）。
3. 悬浮任务行 → 点击日期图标 → NDatePicker 浮层（与日期斜杠命令同款样式）→ 选择日期 → chip 出现在文本行尾。
4. 点击 chip → 重新选择日期；悬浮 chip 点 × → 清除日期。
5. 用文本编辑器打开对应 markdown 文件，确认格式为 `- [x] 完成报告 [[2026-09-06]]`；无日期行为 `- [ ] 任务`。
6. 旧文档（`- [ ] 任务` 纯文本）打开 → 正常解析为任务列表。
7. BubbleMenu 块类型面板切「任务」、Tab/Shift-Tab 缩进、回车拆分任务项均正常。

- [ ] **Step 5: 提交（如有修复）**

```bash
git add -A
git commit -m "fix(editor): regression fixes for custom task node"
```

（仅在有修复时执行；然后推送分支并发起 PR 到 dev——dev 分支受保护，禁止直接 push。）

```bash
git push -u origin feat/custom-task-node
```

---

## Self-Review 记录

1. **规格覆盖**：自定义 node（Task 2）✓；标识符 `- [ ]`/`- [x]`（Task 1/3）✓；任务属性状态（checked，Task 2/4）+ 日期（date，Task 2-4）✓；点击勾选框切换（Task 4 change 处理器，鼠标+键盘）✓；日期双中括号包裹（Task 3 序列化 + Task 1 解析剥离）✓；点击打开日期控件（Task 4 pickDate 复用）✓；复用日期斜杠命令样式（pickDate 函数级复用，同一 NDatePicker panel）✓；增加功能（添加日期按钮、清除、修改）✓。
2. **占位符扫描**：无 TBD/TODO；所有代码步骤给出完整代码；命令给出预期输出。
3. **类型一致性**：`WrispTaskItem`（Task 2 定义，Task 3/4/5 引用）✓；`registerTaskItemBridge`（Task 1 定义，Task 5 引用）✓；`TaskItemView.vue`（Task 4 定义并被扩展引用）✓；i18n 键 `EDITOR.TASK_ITEM.*` 四键两语言成对（Task 4 定义、NodeView 使用）✓；`sanitizeTaskDate`/`appendDateSuffix`（Task 2/3 定义并使用）✓；测试辅助 `createEditor`/`loadMarkdown`/`collectTaskItems`（Task 2 定义，Task 3/5 复用）✓。
4. **外部依赖实测验证**（已逐一核实代码库）：
   - `pickDate(editor, pos, placeholder?)` 签名与返回 `Promise<string>`（取消返回 `""`）与 Task 4 用法一致 ✓
   - `parseIndentedBlocks` / `renderNestedMarkdownContent` 确认从 `@tiptap/core` 公开导出（`dist/index.d.ts:5034/5094`）✓
   - `EventFilled` 确认从 `@vicons/material` 导出（`index.js:21775`）✓
   - i18n `PLACEHOLDER` 键位置（zhCN.ts:243 / enUS.ts:245）与 Task 4 Step 1 插入点一致 ✓
   - `extensions.ts` 第 7/32/91-94 行与 Task 5 Step 3 的修改位置一致；`Markdown` 扩展已注册（`getMarkdown()` 可用）✓
   - `_markdown.scss` 任务清单规则位于 112-126 行，与 Task 5 Step 4 插入点一致 ✓
   - 样式变量 `--primary-color`/`--text-secondary`/`--text-quaternary` 在 themes.scss 中存在 ✓
   - `VueNodeViewRenderer(component, { stopEvent, ignoreMutation })` 二参用法与 image-extension.ts 现有实现一致 ✓
5. **自审修复**：Task 4 测试文件原缺 `vi.mock()` 工厂调用（`vi.mocked()` 仅提供类型、不产生 mock，运行时 `mockReset()` 会抛错），已补上 `vi.mock("@/renderer/components/editor/slash/commands/datePicker", () => ({ pickDate: vi.fn() }))`。
