import { Extension } from "@tiptap/core";
import { Mathematics } from "@tiptap/extension-mathematics";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import "katex/dist/katex.min.css";

/** 数学公式编辑请求事件名（点击公式节点时派发） */
const MATH_EDIT_EVENT = "wrisp-math-edit";

interface MathEditDetail {
  node: PMNode;
  pos: number;
}

/**
 * LaTeX 输入浮层（纯 DOM）：
 * Enter / ✓ 确认（onApply，空输入也回调，由回调决定是否取消），
 * Esc / ✕ / 点击浮层外部取消。
 */
interface MathPopoverOptions {
  /** 输入框初始值（编辑已有公式传原 latex，插入传空串） */
  initial: string;
  placeholder: string;
  onApply: (latex: string) => void;
}

interface MathPopover {
  element: HTMLDivElement;
  dismiss: () => void;
}

/** 移除所有已存在的公式浮层（同一时间只保留一个） */
function removeMathPopovers(): void {
  document.querySelectorAll(".math-edit-popover").forEach((el) => el.remove());
}

function createMathPopover(options: MathPopoverOptions): MathPopover {
  const popover = document.createElement("div");
  popover.className = "math-edit-popover";
  popover.style.cssText = `
    position: fixed; z-index: 10000; display: flex; align-items: center; gap: 6px;
    background: var(--bg-primary, #fff); border: 1px solid var(--border-color, #ddd);
    border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.2); padding: 6px 8px;`;

  const input = document.createElement("input");
  input.type = "text";
  input.value = options.initial;
  input.placeholder = options.placeholder;
  input.style.cssText = `
    width: 260px; height: 30px; padding: 0 8px; font-size: 13px;
    color: var(--text-color, #333); background: var(--bg-secondary, #f5f5f5);
    border: 1px solid var(--border-color, #ddd); border-radius: 4px; outline: none;`;

  const confirm = document.createElement("button");
  confirm.textContent = "✓";
  confirm.title = "确认";
  confirm.style.cssText = `
    width: 28px; height: 28px; border: none; border-radius: 4px; cursor: pointer;
    background: var(--primary-color, #18a058); color: #fff; font-size: 14px;`;

  const cancel = document.createElement("button");
  cancel.textContent = "✕";
  cancel.title = "取消";
  cancel.style.cssText = `
    width: 28px; height: 28px; border: none; border-radius: 4px; cursor: pointer;
    background: transparent; color: var(--text-third, #999); font-size: 14px;`;

  popover.appendChild(input);
  popover.appendChild(confirm);
  popover.appendChild(cancel);
  document.body.appendChild(popover);

  function apply(): void {
    options.onApply(input.value.trim());
  }

  function onDocMouseDown(e: MouseEvent): void {
    if (!popover.contains(e.target as Node)) dismiss();
  }

  function dismiss(): void {
    popover.remove();
    document.removeEventListener("mousedown", onDocMouseDown);
  }

  confirm.addEventListener("click", apply);
  cancel.addEventListener("click", dismiss);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
    }
  });
  document.addEventListener("mousedown", onDocMouseDown);
  input.focus();
  input.select();

  // 焦点守卫：编辑器链式 focus 命令经 rAF 延迟调用 view.focus()，
  // 会在浮层打开后抢回焦点（如斜杠菜单关闭后的重新聚焦）。
  // 双 rAF 兜底重新聚焦输入框；浮层已关闭或焦点仍在浮层内（如 ✓/✕）时不动作。
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (popover.isConnected && !popover.contains(document.activeElement)) {
        input.focus();
      }
    }),
  );

  return { element: popover, dismiss };
}

/** 浮层定位：锚点下方，空间不足时移到上方 */
function positionMathPopover(
  popover: HTMLElement,
  rect: { left: number; top: number; bottom: number },
): void {
  if (window.innerHeight - (rect.bottom + 4) < 60 && rect.top > 60) {
    popover.style.top = `${rect.top - 48 - 4}px`;
  } else {
    popover.style.top = `${rect.bottom + 4}px`;
  }
  popover.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 340))}px`;
}

/**
 * 编辑已有公式节点：在公式下方弹出 LaTeX 输入框，
 * Enter 确认更新节点，Esc / 点击外部取消。
 */
function showMathEditor(editor: Editor, node: PMNode, pos: number): void {
  removeMathPopovers();

  const anchor = editor.view.domAtPos(pos + 1).node;
  const anchorEl = anchor instanceof HTMLElement ? anchor : editor.view.dom;

  const popover = createMathPopover({
    initial: (node.attrs.latex as string) ?? "",
    placeholder: node.type.name === "inlineMath"
      ? "行内公式，如 E=mc^2"
      : "块级公式，如 \\sum_{i=1}^{n} x_i",
    onApply: (latex) => {
      popover.dismiss();
      if (!latex) return;
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          const current = editor.state.doc.nodeAt(pos);
          // 校验节点未在编辑期间被删除或移动
          if (!current || current.type.name !== node.type.name) return false;
          tr.setNodeMarkup(pos, undefined, { ...current.attrs, latex });
          return true;
        })
        .run();
    },
  });
  positionMathPopover(popover.element, anchorEl.getBoundingClientRect());
}

/**
 * 插入行内公式（无默认值）：
 * 在当前光标处弹出空的 LaTeX 输入框（调用前斜杠文本应已删除，光标即插入点）；
 * 确认且输入非空时插入行内公式，输入为空或取消（Esc / ✕ / 点击外部）则不插入任何内容。
 */
export function showInlineMathInput(editor: Editor): void {
  removeMathPopovers();

  const anchorPos = editor.state.selection.from;
  const coords = editor.view.coordsAtPos(anchorPos);

  const popover = createMathPopover({
    initial: "",
    placeholder: "输入 LaTeX 公式，如 E=mc^2",
    onApply: (latex) => {
      popover.dismiss();
      if (!latex) return;
      editor
        .chain()
        .focus()
        .insertInlineMath({ latex, pos: anchorPos })
        .run();
    },
  });
  positionMathPopover(popover.element, {
    left: coords.left,
    top: coords.top,
    bottom: coords.bottom,
  });
}

/**
 * 事件桥接扩展：Mathematics 的 onClick 回调不携带 editor 实例，
 * 通过 DOM 事件派发到本桥接器，由持有该节点的编辑器处理
 * （多编辑器实例共存时按节点同一性精确路由）。
 * 工厂形式确保每个编辑器获得独立扩展实例。
 */
function createMathEditBridge() {
  let eventHandler: ((e: Event) => void) | null = null;
  return Extension.create({
    name: "mathEditBridge",

    onBeforeCreate() {
      eventHandler = (e: Event) => {
        const { node, pos } = (e as CustomEvent<MathEditDetail>).detail;
        const current = this.editor.state.doc.nodeAt(pos);
        if (current === node) {
          showMathEditor(this.editor, node, pos);
        }
      };
      document.addEventListener(MATH_EDIT_EVENT, eventHandler);
    },

    onDestroy() {
      if (eventHandler) {
        document.removeEventListener(MATH_EDIT_EVENT, eventHandler);
        eventHandler = null;
      }
    },
  });
}

/**
 * 创建数学公式扩展集：
 * - Mathematics（行内 $...$ + 块级 $$...$$，KaTeX 渲染）
 * - 点击公式节点弹出 LaTeX 编辑浮层的桥接扩展
 */
export function createMathematicsExtension() {
  const dispatchEdit = (node: PMNode, pos: number): void => {
    document.dispatchEvent(new CustomEvent<MathEditDetail>(MATH_EDIT_EVENT, { detail: { node, pos } }));
  };

  const mathematics = Mathematics.configure({
    katexOptions: { throwOnError: false, strict: false },
    inlineOptions: {
      onClick: dispatchEdit,
    },
    blockOptions: {
      onClick: dispatchEdit,
    },
  });

  return [mathematics, createMathEditBridge()];
}
