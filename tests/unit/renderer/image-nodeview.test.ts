import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/vue-3";
import { getExtensions } from "@/renderer/components/editor/extensions";

/**
 * 回归：图片自定义 NodeView（VueNodeViewRenderer + ImageView.vue）
 * 曾因缺少 NodeViewWrapper / ignoreMutation 返回 false 导致 view 更新崩溃，
 * 整篇 markdown 内容渲染不出来。
 */
describe("image node view regression", () => {
  const editors: Editor[] = [];

  afterEach(() => {
    for (const ed of editors.splice(0)) {
      ed.destroy();
    }
  });

  function createEditor(content: string): Editor {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const ed = new Editor({
      element: el,
      extensions: getExtensions(),
      content,
    });
    editors.push(ed);
    return ed;
  }

  it("纯文本内容正常渲染（不受图片扩展影响）", () => {
    const ed = createEditor("<h1>标题</h1><p>hello <strong>world</strong></p>");
    expect(ed.getHTML()).toContain("hello");
    expect(ed.getText()).toContain("标题");
  });

  it("含图片的 markdown 内容正常渲染，img 保留 src", () => {
    const ed = createEditor(
      '<p>一段文字</p><img src="app://workspace/attachments/images/20260829120000000.png" alt="截图">',
    );
    const html = ed.getHTML();
    expect(html).toContain("<img");
    expect(html).toContain("attachments/images");
    expect(ed.getText()).toContain("一段文字");
  });

  it("图片 width/align 属性解析与序列化", () => {
    const ed = createEditor(
      '<img src="app://workspace/attachments/images/a.png" width="300" class="image-align-center">',
    );
    const html = ed.getHTML();
    expect(html).toContain("300");
    expect(html).toContain("image-align-center");
  });

  it("更新图片属性后内容仍可正常序列化", () => {
    const ed = createEditor('<img src="app://workspace/attachments/images/a.png">');
    ed.commands.updateAttributes("image", { width: 500, align: "right" });
    const html = ed.getHTML();
    expect(html).toContain("500");
    expect(html).toContain("image-align-right");
  });
});
