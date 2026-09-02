import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { marked } from "marked";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Admonition, registerAdmonitionBridge } from "@/renderer/components/editor/features/admonition/admonition-extension";

// 模拟应用启动时的桥接注册（幂等）
registerAdmonitionBridge();

const editors: Editor[] = [];

function createEditor(): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, Markdown, Admonition],
  });
  editors.push(editor);
  return editor;
}

/** 复现应用读取链路：md →（marked 桥接）→ HTML → setContent */
function loadMarkdown(editor: Editor, md: string): void {
  const html = marked.parse(md) as string;
  editor.commands.setContent(html);
}

/** 统计文档中指定类型节点数量 */
function countNodes(editor: Editor, type: string): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === type) count += 1;
    return true;
  });
  return count;
}

/** 收集文档中指定类型的所有节点 */
function collectNodes(editor: Editor, type: string): PMNode[] {
  const nodes: PMNode[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === type) nodes.push(node);
    return true;
  });
  return nodes;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

describe("admonition 桥接解析", () => {
  it(":::type 围栏 → 桥接 HTML → admonition 节点（含 type 属性）", () => {
    const editor = createEditor();
    const md = ":::warning\n这里是警告内容。\n:::";
    const html = marked.parse(md) as string;

    expect(html).toContain('data-admonition=""');
    expect(html).toContain('data-type="warning"');
    expect(html).toContain("这里是警告内容。");

    loadMarkdown(editor, md);
    expect(countNodes(editor, "admonition")).toBe(1);

    const admonition = collectNodes(editor, "admonition")[0];
    expect(admonition?.attrs.type).toBe("warning");
    // 内容解析为段落子块
    expect(admonition?.childCount).toBe(1);
    expect(admonition?.firstChild?.type.name).toBe("paragraph");
  });

  it("行内格式与多个子块正常解析", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      ":::note\n**加粗** 与 *斜体*\n\n- 列表项 A\n- 列表项 B\n:::",
    );

    const admonition = collectNodes(editor, "admonition")[0];
    expect(admonition?.attrs.type).toBe("note");
    expect(admonition?.childCount).toBe(2);
    expect(admonition?.child(0)?.type.name).toBe("paragraph");
    expect(admonition?.child(1)?.type.name).toBe("bulletList");
    // 行内格式保留（bold/italic 是 mark，经文本节点检查）
    const text = admonition?.textContent ?? "";
    expect(text).toContain("加粗");
    expect(text).toContain("斜体");
    const marks = new Set<string>();
    admonition?.descendants((node) => {
      node.marks.forEach((mark) => marks.add(mark.type.name));
      return true;
    });
    expect(marks.has("bold")).toBe(true);
    expect(marks.has("italic")).toBe(true);
  });

  it("嵌套 admonition 解析（depth 计数）", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      ":::warning\n外层内容\n\n:::tip\n内层内容\n:::\n:::",
    );

    const admonitions = collectNodes(editor, "admonition");
    expect(admonitions).toHaveLength(2);
    // 外层 warning 包含内层 tip
    const outer = admonitions.find((n) => n.attrs.type === "warning");
    const inner = admonitions.find((n) => n.attrs.type === "tip");
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(outer?.nodeSize).toBeGreaterThan(inner?.nodeSize ?? 0);
  });

  it("内部 metric 围栏不干扰闭合（裸 ::: 优先匹配外层）", () => {
    const editor = createEditor();
    // 提示块内包含 :::metric 围栏：闭合计数应正确归属
    loadMarkdown(
      editor,
      ":::note\n说明文字\n\n:::metric\nlabel: DAU\n:::\n:::",
    );

    expect(countNodes(editor, "admonition")).toBe(1);
    // metric 内容按普通文本降级（测试环境未注册 metric 桥接），但文字不丢失
    const admonition = collectNodes(editor, "admonition")[0];
    expect(admonition?.textContent).toContain("label: DAU");
  });

  it("未闭合围栏降级为普通段落（不丢失内容）", () => {
    const editor = createEditor();
    loadMarkdown(editor, ":::note\n只有内容没有闭合");

    expect(countNodes(editor, "admonition")).toBe(0);
    const text = editor.state.doc.textContent;
    expect(text).toContain(":::note");
    expect(text).toContain("只有内容没有闭合");
  });

  it("非白名单类型不构成 admonition（按段落降级）", () => {
    const editor = createEditor();
    loadMarkdown(editor, ":::custom\n不是提示块\n:::");

    expect(countNodes(editor, "admonition")).toBe(0);
    expect(editor.state.doc.textContent).toContain("不是提示块");
  });

  it("桥接 HTML 中非法 data-type 回退 note（白名单校验）", () => {
    const editor = createEditor();
    editor.commands.setContent('<div data-admonition="" data-type="hack">内容</div>');

    const admonition = collectNodes(editor, "admonition")[0];
    expect(admonition?.attrs.type).toBe("note");
  });
});

describe("admonition 序列化与 round-trip", () => {
  it("getMarkdown 输出 ::: 围栏格式", () => {
    const editor = createEditor();
    loadMarkdown(editor, ":::danger\n危险操作。\n:::");

    const out = editor.getMarkdown();
    expect(out).toContain(":::danger");
    expect(out).toContain("危险操作。");
    expect(out.trimEnd().endsWith(":::")).toBe(true);
  });

  it("round-trip 幂等：加载 → 序列化 → 再加载一致", () => {
    const editor = createEditor();
    const md = ":::tip\n Round-trip 提示。\n\n第二段。\n:::";
    loadMarkdown(editor, md);
    const once = editor.getMarkdown();

    loadMarkdown(editor, once);
    const twice = editor.getMarkdown();
    expect(twice).toBe(once);
  });

  it("混合文档 round-trip：标题 + 提示块 + 段落不丢失", () => {
    const editor = createEditor();
    const md = ["# 标题", "", ":::info", "信息内容。", ":::", "", "结尾段落。"].join("\n");

    loadMarkdown(editor, md);
    const out = editor.getMarkdown();

    expect(out).toContain("# 标题");
    expect(out).toContain(":::info");
    expect(out).toContain("信息内容。");
    expect(out).toContain("结尾段落。");

    // 二次 round-trip 稳定
    loadMarkdown(editor, out);
    expect(editor.getMarkdown()).toBe(out);
  });

  it("toggleWrap 插入 + updateAttributes 切换类型后序列化正确", () => {
    const editor = createEditor();
    editor.commands.setContent("<p>目标段落</p>");
    // 光标置于段落内（toggleWrap 包裹光标所在块，而非整个文档）
    editor.commands.setTextSelection(1);

    // 斜杠命令路径：包裹为提示块（默认 note）
    editor.chain().focus().toggleWrap("admonition", { type: "note" }).run();
    expect(editor.isActive("admonition")).toBe(true);
    let admonition = collectNodes(editor, "admonition")[0];
    expect(admonition?.attrs.type).toBe("note");
    expect(admonition?.textContent).toContain("目标段落");

    // 气泡菜单路径：切换类型
    editor.chain().focus().updateAttributes("admonition", { type: "warning" }).run();
    admonition = collectNodes(editor, "admonition")[0];
    expect(admonition?.attrs.type).toBe("warning");

    // 再次 toggleWrap 提升回普通块
    editor.chain().focus().toggleWrap("admonition", { type: "warning" }).run();
    expect(editor.isActive("admonition")).toBe(false);
    expect(countNodes(editor, "admonition")).toBe(0);
    expect(editor.state.doc.textContent).toContain("目标段落");
  });

  it("toggleWrap 插入后序列化 → 重载结构保持", () => {
    const editor = createEditor();
    editor.commands.setContent("<p>内容</p>");
    editor.commands.setTextSelection(1);
    editor.chain().focus().toggleWrap("admonition", { type: "tip" }).run();

    const out = editor.getMarkdown();
    expect(out).toContain(":::tip");

    loadMarkdown(editor, out);
    expect(countNodes(editor, "admonition")).toBe(1);
    expect(collectNodes(editor, "admonition")[0]?.attrs.type).toBe("tip");
    expect(editor.getMarkdown()).toBe(out);
  });
});
