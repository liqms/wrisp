import { describe, it, expect, afterEach } from "vitest";
import { marked } from "marked";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { registerTaskItemBridge, WrispTaskItem } from "@/renderer/components/editor/features/task-item/task-item-extension";
import { Editor as VueEditor } from "@tiptap/vue-3";
import { getExtensions } from "@/renderer/components/editor/extensions";

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

  it("[[YYYY-MM-DD]] 保留在文本中（统一日期文本，非任务属性）", () => {
    const html = marked.parse("- [x] 完成报告 [[2026-09-06]]") as string;
    expect(html).not.toContain("data-date");
    expect(html).toContain("完成报告");
    expect(html).toContain("[[2026-09-06]]");
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

const editors: Editor[] = [];

function createEditor(): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, Markdown, TaskList, WrispTaskItem.configure({ nested: true })],
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

  it("日期保留在文本内容中（无 date 专属属性，与正文 [[...]] 统一）", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [x] 完成报告 [[2026-09-06]]");
    const item = collectTaskItems(editor)[0];
    expect("date" in (item?.attrs ?? {})).toBe(false);
    expect(item?.textContent).toBe("完成报告 [[2026-09-06]]");
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

describe("任务节点序列化（getMarkdown）", () => {
  it("未完成/已完成 → - [ ] / - [x] 前缀", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] A\n- [x] B");
    const out = editor.getMarkdown();
    expect(out).toContain("- [ ] A");
    expect(out).toContain("- [x] B");
  });

  it("日期文本随正文统一转义（\\[\\[...\\]\\]），round-trip 幂等", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [x] 完成报告 [[2026-09-06]]");
    const once = editor.getMarkdown();
    // @tiptap/markdown 默认转义 [ ]，与段落里斜杠命令插入的 [[日期]] 行为一致
    expect(once).toContain("- [x] 完成报告 \\[\\[2026-09-06\\]\\]");
    // 转义格式再读入还原为 [[...]] 文本，序列化稳定
    loadMarkdown(editor, once);
    expect(editor.getMarkdown()).toBe(once);
  });

  it("round-trip 幂等：加载 → 序列化 → 再加载 → 再序列化一致", () => {
    const editor = createEditor();
    const md = "- [ ] A [[2026-09-01]]\n- [x] B";
    loadMarkdown(editor, md);
    const once = editor.getMarkdown();
    loadMarkdown(editor, once);
    expect(editor.getMarkdown()).toBe(once);
  });

  it("切换 checked 后序列化联动（setNodeMarkup 路径，同官方 NodeView 行为）", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] 任务");
    let pos = -1;
    editor.state.doc.descendants((node, p) => {
      if (node.type.name === "taskItem" && pos < 0) pos = p;
      return true;
    });
    expect(pos).toBeGreaterThanOrEqual(0);
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(pos, undefined, { checked: true }),
    );
    const out = editor.getMarkdown();
    expect(out).toContain("- [x] 任务");
  });

  it("任务内行内格式（加粗）保留", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [ ] **重点**任务");
    const out = editor.getMarkdown();
    expect(out).toContain("**重点**");
  });

  it("带日期 + 嵌套子任务：日期随首行文本，子块缩进保持", () => {
    const editor = createEditor();
    loadMarkdown(editor, "- [x] 父任务 [[2026-09-06]]\n  - [ ] 子任务");
    const out = editor.getMarkdown();
    expect(out).toContain("- [x] 父任务 \\[\\[2026-09-06\\]\\]");
    // 子任务行需保留嵌套缩进（两个空格）
    expect(out).toContain("  - [ ] 子任务");
    // round-trip 幂等
    loadMarkdown(editor, out);
    expect(editor.getMarkdown()).toBe(out);
  });
});

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
    expect(item?.textContent).toBe("完成报告 [[2026-09-06]]");

    expect(editor.getMarkdown()).toContain("- [x] 完成报告 \\[\\[2026-09-06\\]\\]");
  });
});
