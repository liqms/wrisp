import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  deleteSlashText,
  insertMarkdownTemplate,
} from "@/renderer/components/editor/slash/commands/helpers";

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [StarterKit],
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length) {
    editors.pop()?.destroy();
  }
});

/** 在文档中定位第一个匹配字符的绝对位置 */
function findPos(editor: Editor, needle: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText && node.text) {
      const idx = node.text.indexOf(needle);
      if (idx >= 0) {
        found = pos + idx;
        return false;
      }
    }
    return true;
  });
  return found;
}

/** 在文档中定位最后一个匹配字符的绝对位置 */
function findLastPos(editor: Editor, needle: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      let idx = node.text.lastIndexOf(needle);
      if (idx >= 0) {
        found = pos + idx;
        return false;
      }
    }
    return true;
  });
  return found;
}

describe("Slash 命令删除/插入辅助函数", () => {
  it("deleteSlashText 只删除斜杠与查询词，不影响后续节点的内容", () => {
    const editor = createEditor("<p>abc/req</p><p>def</p>");
    const pos = findPos(editor, "r");
    deleteSlashText(editor, pos);
    expect(editor.getHTML()).toBe("<p>abc</p><p>def</p>");
  });

  it("insertMarkdownTemplate 插入模板不会覆盖后面节点的数据", () => {
    const editor = createEditor("<p>abc/req</p><p>def</p>");
    const pos = findPos(editor, "r");
    insertMarkdownTemplate(editor, pos, "- 需求：");
    const html = editor.getHTML();
    expect(html).toContain("<p>def</p>");
    expect(html).toContain("需求");
    expect(html).toContain("<p>abc</p>");
  });

  it("查询词后紧跟空白时只删除查询词", () => {
    const editor = createEditor("<p>abc/req hi</p><p>def</p>");
    const pos = findPos(editor, "r");
    deleteSlashText(editor, pos);
    expect(editor.getHTML()).toBe("<p>abc hi</p><p>def</p>");
  });

  it("在文档末尾插入模板不报错且正常插入", () => {
    const editor = createEditor("<p>abc/req</p>");
    const pos = findPos(editor, "r");
    insertMarkdownTemplate(editor, pos, "- 需求：");
    expect(editor.getHTML()).toContain("需求");
  });

  it("查询在菜单输入框输入时（编辑器仅含 /），只删除 / 不影响前一区块", () => {
    const editor = createEditor("<p>hello</p><p>/</p>");
    const pos = findLastPos(editor, "/") + 1; // slashStartPos = 斜杠后一位
    deleteSlashText(editor, pos);
    expect(editor.getHTML()).toBe("<p>hello</p><p></p>");
  });

  it("前一区块含 / 时，也只删除当前区块的斜杠", () => {
    const editor = createEditor("<p>a/b</p><p>/</p>");
    const pos = findLastPos(editor, "/") + 1;
    deleteSlashText(editor, pos);
    expect(editor.getHTML()).toBe("<p>a/b</p><p></p>");
  });

  it("斜杠在区块中间（空格后）时，只删除斜杠保留前面文字", () => {
    const editor = createEditor("<p>abc /</p>");
    const pos = findLastPos(editor, "/") + 1;
    deleteSlashText(editor, pos);
    expect(editor.getHTML()).toBe("<p>abc </p>");
  });
});
