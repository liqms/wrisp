import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { createInlineSemanticDecoration } from "@/renderer/components/editor/features/inline-semantic/inline-semantic-decoration";

function createEditor(content: string): Editor {
  return new Editor({
    extensions: [StarterKit, createInlineSemanticDecoration()],
    content,
  });
}

describe("InlineSemanticDecoration", () => {
  it("文本中的 [[双链]]/#标签/@人物 生成带 class 的 DOM", () => {
    const editor = createEditor("<p>[[计划]] 和 #科幻 与@张三</p>");
    const html = editor.view.dom.innerHTML;
    expect(html).toContain("inline-sem");
    expect(html).toContain("inline-sem-symbol");
    editor.destroy();
  });

  it("普通文本不产生 decoration", () => {
    const editor = createEditor("<p>普通文本没有 token</p>");
    const html = editor.view.dom.innerHTML;
    expect(html).not.toContain("inline-sem");
    editor.destroy();
  });

  it("代码块内的 token 不渲染 decoration", () => {
    const editor = createEditor("<pre><code>#tag @name [[x]]</code></pre>");
    const html = editor.view.dom.innerHTML;
    expect(html).not.toContain("inline-sem");
    editor.destroy();
  });

  it("编辑（输入新 token）后 decoration 实时更新", () => {
    const editor = createEditor("<p>文本</p>");
    editor.commands.insertContentAt(editor.state.doc.content.size, "#新标签 ");
    const html = editor.view.dom.innerHTML;
    expect(html).toContain("inline-sem");
    editor.destroy();
  });
});
