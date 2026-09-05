import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { extractInlineTokens } from "@/shared/utils/text-tokens";

const inlineSemanticKey = new PluginKey("inlineSemanticDecoration");

/**
 * 遍历文档中的 text node，为 [[双链]] / #标签 / @人物 添加 Decoration：
 * - 整体区间加 .inline-sem（容器样式，悬浮突出）
 * - 符号区间（[[、]]、#、@）加 .inline-sem-symbol（弱化样式）
 */
function buildInlineSemanticDecorations(doc: ProsemirrorNode): Decoration[] {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // 跳过代码块（其内部的 token 不做语义渲染）
    if (node.type.name === "codeBlock") {
      return false;
    }
    if (!node.isText || !node.text) {
      return true;
    }

    for (const token of extractInlineTokens(node.text)) {
      const from = pos + token.start;
      const to = pos + token.end;

      // 整体容器
      decorations.push(Decoration.inline(from, to, { class: "inline-sem" }));
      // 前置符号
      decorations.push(
        Decoration.inline(from, from + token.symbolLength, {
          class: "inline-sem-symbol",
        }),
      );
      // wiki 的右括号
      if (token.type === "wiki") {
        decorations.push(
          Decoration.inline(to - 2, to, { class: "inline-sem-symbol" }),
        );
      }
    }
    return true;
  });

  return decorations;
}

/**
 * 行内语义 Decoration 扩展：纯视觉渲染，不改变文档结构。
 * markdown 存储格式不变，历史文档打开即生效。
 */
export function createInlineSemanticDecoration() {
  return Extension.create({
    name: "inlineSemanticDecoration",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: inlineSemanticKey,
          state: {
            init: (_, { doc }) =>
              DecorationSet.create(doc, buildInlineSemanticDecorations(doc)),
            apply: (tr, old) => {
              if (tr.docChanged) {
                return DecorationSet.create(
                  tr.doc,
                  buildInlineSemanticDecorations(tr.doc),
                );
              }
              return old.map(tr.mapping, tr.doc);
            },
          },
          props: {
            decorations: (state) => inlineSemanticKey.getState(state),
          },
        }),
      ];
    },
  });
}
