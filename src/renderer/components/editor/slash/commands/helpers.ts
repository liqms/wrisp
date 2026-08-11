import type { Editor } from "@tiptap/core";
import { marked } from "marked";

/** 删除斜杠及后面的查询文本 */
export function deleteSlashText(editor: Editor, pos: number) {
  const { state } = editor;
  const { doc } = state;
  let endPos = pos;
  while (endPos < doc.content.size) {
    const char = doc.textBetween(endPos, endPos + 1);
    if (char === " " || char === "\n") break;
    endPos++;
  }
  if (endPos === pos) {
    const textBefore = doc.textBetween(Math.max(0, pos - 10), pos);
    const slashIdx = textBefore.lastIndexOf("/");
    if (slashIdx >= 0) {
      const actualStart = Math.max(0, pos - 10) + slashIdx;
      editor
        .chain()
        .focus()
        .deleteRange({ from: actualStart, to: pos })
        .run();
      return;
    }
  }
  editor.chain().focus().deleteRange({ from: pos - 1, to: endPos }).run();
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 格式化日期时间为 YYYY-MM-DD HH:mm:ss */
export function formatDateTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${formatDate(d)} ${h}:${min}:${s}`;
}

/**
 * 将 Markdown 模板转为 HTML 并插入编辑器光标位置。
 * 先删除 /查询词，再插入模板内容。
 */
export function insertMarkdownTemplate(
  editor: Editor,
  pos: number,
  markdown: string,
): void {
  deleteSlashText(editor, pos);
  const html = marked.parse(markdown) as string;
  editor.chain().focus().insertContent(html).run();
}
