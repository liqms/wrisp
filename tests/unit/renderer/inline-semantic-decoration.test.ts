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

  it("悬浮 token 任意一段时，同 token 的全部 span 联动加 is-token-hover", () => {
    const editor = createEditor("<p>[[计划]] 和 #科幻</p>");
    const dom = editor.view.dom;

    // ProseMirror 将重叠 decoration 拆分为兄弟 span：wiki 应有 3 段（[[、计划、]]）
    const firstSpan = dom.querySelector("[data-token-id]") as HTMLElement;
    const tokenId = firstSpan.getAttribute("data-token-id");
    const sameToken = Array.from(
      dom.querySelectorAll(`[data-token-id="${tokenId}"]`),
    );
    expect(sameToken.length).toBeGreaterThan(1);

    // 悬浮第一段（[[）
    firstSpan.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true }),
    );
    sameToken.forEach((el) =>
      expect(el.classList.contains("is-token-hover")).toBe(true),
    );

    // 移出（relatedTarget 为编辑器空白处）后取消联动
    firstSpan.dispatchEvent(
      new MouseEvent("mouseout", { bubbles: true, relatedTarget: dom }),
    );
    sameToken.forEach((el) =>
      expect(el.classList.contains("is-token-hover")).toBe(false),
    );

    // 其他 token 不受影响
    const otherToken = dom.querySelectorAll(
      `[data-token-id]:not([data-token-id="${tokenId}"])`,
    );
    otherToken.forEach((el) =>
      expect(el.classList.contains("is-token-hover")).toBe(false),
    );
    editor.destroy();
  });

  it("在同 token 的两段之间移动时保持联动高亮", () => {
    const editor = createEditor("<p>[[计划]]</p>");
    const dom = editor.view.dom;
    const spans = Array.from(
      dom.querySelectorAll("[data-token-id]"),
    ) as HTMLElement[];
    expect(spans.length).toBeGreaterThanOrEqual(2);

    spans[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    // 从第一段移入第二段：relatedTarget 是同 token 的 span，不取消高亮
    spans[0].dispatchEvent(
      new MouseEvent("mouseout", { bubbles: true, relatedTarget: spans[1] }),
    );
    spans.forEach((el) =>
      expect(el.classList.contains("is-token-hover")).toBe(true),
    );
    editor.destroy();
  });
});
