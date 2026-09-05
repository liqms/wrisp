import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { extractInlineTokens } from "@/shared/utils/text-tokens";

const inlineSemanticKey = new PluginKey<InlineSemanticState>(
  "inlineSemanticDecoration",
);

interface InlineSemanticState {
  /** 当前悬浮的 token id（null=无悬浮） */
  hoverTokenId: string | null;
  deco: DecorationSet;
}

/**
 * 遍历文档中的 text node，为 [[双链]] / #标签 / @人物 添加 Decoration：
 * - 整体区间加 .inline-sem（容器样式，悬浮突出）
 * - 符号区间（[[、]]、#、@）加 .inline-sem-symbol（弱化样式）
 * - 同一 token 的全部区间共享 data-token-id（ProseMirror 会把重叠的
 *   inline decoration 拆分合并为兄弟 span，悬浮联动需借助该 id 定位）
 * - 悬浮中的 token（hoverTokenId 匹配）全部区间追加 .is-token-hover
 */
function buildInlineSemanticDecorations(
  doc: ProsemirrorNode,
  hoverTokenId: string | null,
): DecorationSet {
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
      const hovered = tokenId === hoverTokenId;

      // 整体容器
      decorations.push(
        Decoration.inline(from, to, {
          class: hovered
            ? "inline-sem is-token-hover"
            : "inline-sem",
          "data-token-id": tokenId,
        }),
      );
      // 前置符号
      decorations.push(
        Decoration.inline(from, from + token.symbolLength, {
          class: hovered
            ? "inline-sem-symbol is-token-hover"
            : "inline-sem-symbol",
          "data-token-id": tokenId,
        }),
      );
      // wiki 的右括号
      if (token.type === "wiki") {
        decorations.push(
          Decoration.inline(to - 2, to, {
            class: hovered
              ? "inline-sem-symbol is-token-hover"
              : "inline-sem-symbol",
            "data-token-id": tokenId,
          }),
        );
      }
    }
    return true;
  });

  return DecorationSet.create(doc, decorations);
}

/** 事件目标（或其祖先）携带的 token id；无则返回 null */
function tokenAt(event: Event): string | null {
  const el = (event.target as HTMLElement | null)?.closest?.(
    "[data-token-id]",
  ) as HTMLElement | null;
  return el?.getAttribute("data-token-id") ?? null;
}

/**
 * 行内语义 Decoration 扩展：纯视觉渲染，不改变文档结构。
 * markdown 存储格式不变，历史文档打开即生效。
 *
 * 悬浮联动实现说明：直接修改 DOM 的 class 会被 ProseMirror 的
 * DOMObserver 捕获并随下次重绘被重置，因此悬浮态必须走 plugin state——
 * mouseover/mouseout 只 dispatch 携带 meta 的空 transaction，
 * 由 apply 重建 DecorationSet，把 .is-token-hover 作为 decoration class
 * 交给 ProseMirror 渲染，重绘也不会丢失。
 */
export function createInlineSemanticDecoration() {
  return Extension.create({
    name: "inlineSemanticDecoration",
    addProseMirrorPlugins() {
      return [
        new Plugin<InlineSemanticState>({
          key: inlineSemanticKey,
          state: {
            init: (_, { doc }) => ({
              hoverTokenId: null,
              deco: buildInlineSemanticDecorations(doc, null),
            }),
            apply: (tr, value) => {
              const meta = tr.getMeta(inlineSemanticKey);
              // meta 可能是 string（token id）、null（取消悬浮）或 undefined（无悬浮变化）
              const hoverTokenId =
                meta === undefined ? value.hoverTokenId : (meta as string | null);
              const hoverChanged = hoverTokenId !== value.hoverTokenId;

              if (tr.docChanged || hoverChanged) {
                return {
                  hoverTokenId,
                  deco: buildInlineSemanticDecorations(tr.doc, hoverTokenId),
                };
              }
              return value;
            },
          },
          props: {
            decorations: (state) => inlineSemanticKey.getState(state)?.deco,
            handleDOMEvents: {
              mouseover: (view, event) => {
                const tokenId = tokenAt(event);
                const current =
                  inlineSemanticKey.getState(view.state)?.hoverTokenId ?? null;
                // 同一 token 内移动不重复 dispatch
                if (tokenId !== current) {
                  const tr: Transaction = view.state.tr;
                  tr.setMeta(inlineSemanticKey, tokenId);
                  tr.setMeta("addToHistory", false);
                  view.dispatch(tr);
                }
                return false;
              },
              mouseout: (view, event) => {
                const tokenId = tokenAt(event);
                if (tokenId === null) return false;
                // 移入同一 token 的另一段时保持高亮
                const related = (
                  event.relatedTarget as HTMLElement | null
                )?.closest?.("[data-token-id]") as HTMLElement | null;
                if (related?.getAttribute("data-token-id") === tokenId) {
                  return false;
                }
                const current =
                  inlineSemanticKey.getState(view.state)?.hoverTokenId ?? null;
                if (current === tokenId) {
                  const tr: Transaction = view.state.tr;
                  tr.setMeta(inlineSemanticKey, null);
                  tr.setMeta("addToHistory", false);
                  view.dispatch(tr);
                }
                return false;
              },
            },
          },
        }),
      ];
    },
  });
}
