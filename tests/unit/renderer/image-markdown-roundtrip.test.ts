import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/vue-3";
import { marked } from "marked";
import { getExtensions } from "@/renderer/components/editor/extensions";

/**
 * 回归：图片展示尺寸/对齐未记录到文档
 * 1. 官方 @tiptap/extension-image 的 renderMarkdown 仅输出 ![alt](src)，width/align 丢失
 * 2. 自定义 renderMarkdown 需把 width/align 序列化为 HTML img 标签（parseHTML 可回读）
 * 3. 无附加属性时必须保持标准 ![alt](src) 语法（文档可移植性）
 *
 * 输入链路与应用一致：markdown → marked 转 HTML → 编辑器解析（见 TiptapEditor.vue mdToHtml）。
 */
describe("image markdown 序列化与往返", () => {
  const editors: Editor[] = [];

  afterEach(() => {
    for (const ed of editors.splice(0)) {
      ed.destroy();
    }
  });

  async function createEditor(markdown: string): Promise<Editor> {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const html = await marked.parse(markdown, { async: true });
    const ed = new Editor({
      element: el,
      extensions: getExtensions(),
      content: html,
    });
    editors.push(ed);
    return ed;
  }

  function findImageAttrs(ed: Editor): Record<string, unknown> {
    let attrs: Record<string, unknown> | null = null;
    ed.state.doc.descendants((node) => {
      if (node.type.name === "image" && !attrs) attrs = node.attrs as Record<string, unknown>;
      return true;
    });
    return attrs ?? {};
  }

  function setImageAttrs(ed: Editor, attrs: Record<string, unknown>) {
    let pos = -1;
    ed.state.doc.descendants((node, p) => {
      if (node.type.name === "image" && pos < 0) pos = p;
      return true;
    });
    expect(pos).toBeGreaterThanOrEqual(0);
    ed.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...findImageAttrs(ed),
        ...attrs,
      });
      return true;
    });
  }

  it("设置 width/align 后 getMarkdown 序列化为带属性的 img 标签", async () => {
    const ed = await createEditor("前文\n\n![截图](app://workspace/attachments/images/t.png)");
    setImageAttrs(ed, { width: 600, align: "center" });

    const md = ed.getMarkdown();
    expect(md).toContain('<img src="app://workspace/attachments/images/t.png"');
    expect(md).toContain('alt="截图"');
    expect(md).toContain('width="600"');
    expect(md).toContain('class="image-align-center"');
  });

  it("无 width/align 时保持标准 markdown 图片语法（不输出 HTML）", async () => {
    const ed = await createEditor("![描述](app://workspace/attachments/images/t.png)");
    const md = ed.getMarkdown();
    expect(md).toContain("![描述](app://workspace/attachments/images/t.png)");
    expect(md).not.toContain("<img");
  });

  it("仅设置 align（width 为 null）也序列化对齐信息", async () => {
    const ed = await createEditor("![a](app://workspace/attachments/images/t.png)");
    setImageAttrs(ed, { align: "right" });

    const md = ed.getMarkdown();
    expect(md).toContain('class="image-align-right"');
    expect(md).not.toContain("width=");
  });

  it("完整往返：markdown → 属性 → markdown → 新编辑器，属性一致", async () => {
    const ed1 = await createEditor("![cat](app://workspace/attachments/images/t.png)");
    setImageAttrs(ed1, { width: 480, align: "left" });
    const md1 = ed1.getMarkdown();

    const ed2 = await createEditor(md1);
    const attrs = findImageAttrs(ed2);
    expect(attrs.width).toBe(480);
    expect(attrs.align).toBe("left");
    expect(attrs.src).toBe("app://workspace/attachments/images/t.png");
    expect(attrs.alt).toBe("cat");

    // 二次序列化稳定（幂等；块级图片序列化会产生前后空行，比较去除首尾空白）
    expect(ed2.getMarkdown().trim()).toBe(md1.trim());
  });

  it("alt 含引号等特殊字符时属性正确转义，往返不丢失", async () => {
    const ed = await createEditor("![a](app://workspace/attachments/images/t.png)");
    setImageAttrs(ed, { alt: '一个"引号"<猫>', width: 320 });

    const md = ed.getMarkdown();
    const ed2 = await createEditor(md);
    const attrs = findImageAttrs(ed2);
    expect(attrs.alt).toBe('一个"引号"<猫>');
    expect(attrs.width).toBe(320);
  });
});
