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
 * - 同一 token 的全部区间共享 data-token-id（ProseMirror 会把重叠的
 *   inline decoration 拆分合并为兄弟 span，悬浮联动需借助该 id 定位）
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
      const tokenId = `tok-${from}-${to}`;

      // 整体容器
      decorations.push(
        Decoration.inline(from, to, {
          class: "inline-sem",
          "data-token-id": tokenId,
        }),
      );
      // 前置符号
      decorations.push(
        Decoration.inline(from, from + token.symbolLength, {
          class: "inline-sem-symbol",
          "data-token-id": tokenId,
        }),
      );
      // wiki 的右括号
      if (token.type === "wiki") {
        decorations.push(
          Decoration.inline(to - 2, to, {
            class: "inline-sem-symbol",
            "data-token-id": tokenId,
          }),
        );
      }
    }
    return true;
  });

  return decorations;
}

/** 给同一 token 的全部 span 切换 is-token-hover class（悬浮整体高亮联动） */
function setTokenHover(view: { dom: HTMLElement }, tokenId: string, hover: boolean): void {
  view.dom
    .querySelectorAll(`[data-token-id="${tokenId}"]`)
    .forEach((el) => el.classList.toggle("is-token-hover", hover));
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
            handleDOMEvents: {
              // 悬浮 token 任意一段（符号或正文）时，同 token 的全部 span 联动高亮：
              // ProseMirror 将重叠的 inline decoration 拆分为兄弟 span，
              // 纯 CSS :hover 只能命中鼠标所在的一段，联动需在此切换 class
              mouseover: (view, event) => {
                const el = (event.target as HTMLElement | null)?.closest?.(
                  "[data-token-id]",
                ) as HTMLElement | null;
                if (el) {
                  const tokenId = el.getAttribute("data-token-id");
                  if (tokenId) setTokenHover(view, tokenId, true);
                }
                return false;
              },
              mouseout: (view, event) => {
                const el = (event.target as HTMLElement | null)?.closest?.(
                  "[data-token-id]",
                ) as HTMLElement | null;
                if (!el) return false;
                const tokenId = el.getAttribute("data-token-id");
                if (!tokenId) return false;
                // 移入同一 token 的另一段时保持高亮
                const related = (
                  event.relatedTarget as HTMLElement | null
                )?.closest?.("[data-token-id]") as HTMLElement | null;
                if (
                  related &&
                  related.getAttribute("data-token-id") === tokenId
                ) {
                  return false;
                }
                setTokenHover(view, tokenId, false);
                return false;
              },
            },
          },
        }),
      ];
    },
  });
}
