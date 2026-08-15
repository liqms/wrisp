import type { Editor } from "@tiptap/core";
import { marked } from "marked";

/** 删除斜杠及后面的查询文本 */
export function deleteSlashText(editor: Editor, pos: number) {
  const { state } = editor;
  const { doc } = state;
  let endPos = pos;
  // 查询文本始终位于同一文本块内，因此以文本块末尾为扫描边界。
  // 节点边界处 textBetween 返回空串（而非 \n），若越过边界会把后续节点的内容一并删除。
  const blockEnd = doc.resolve(pos).end();
  while (endPos < blockEnd && endPos < doc.content.size) {
    const char = doc.textBetween(endPos, endPos + 1);
    if (char === " " || char === "\n" || char === "") break;
    endPos++;
  }
  if (endPos === pos) {
    // 查询在菜单输入框中输入时，编辑器内只有 "/"。
    // 仅在当前文本块内反向查找斜杠，避免越过块边界把前一区块的内容一并删除。
    const blockStart = doc.resolve(pos).start();
    const textBefore = doc.textBetween(blockStart, pos);
    const slashIdx = textBefore.lastIndexOf("/");
    if (slashIdx >= 0) {
      const actualStart = blockStart + slashIdx;
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
