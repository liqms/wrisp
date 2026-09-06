/**
 * 块拖拽排序：拖拽手柄 + 添加块按钮 + 落点插入线
 *
 * 组成：
 * 1. `renderDragHandle` — 供 `@tiptap/extension-drag-handle` 使用的自定义手柄
 *    （"＋ 添加块"按钮 + ⠿ 六点拖拽图标）。官方扩展负责手柄的显示/定位（floating-ui）、
 *    dragstart 时设置 `view.dragging` 与拖拽预览，块的实际搬移由 ProseMirror 原生 drop 逻辑完成。
 * 2. `handleNodeChange` — 供 `DragHandle.configure({ onNodeChange })` 使用，
 *    记录手柄当前悬停的块（编辑器 + 节点 + 位置），供"添加块"按钮点击时定位插入点。
 * 3. `DropLine` — 插入线插件：拖拽期间基于 `dropPoint()`（ProseMirror 原生落点算法）
 *    渲染蓝色插入线，所见即所得；同时在滚动容器边缘自动滚动。
 *
 * 落点算法与 prosemirror-view 的 `handleDrop` 完全一致（同一个 `dropPoint` 导出），
 * 因此插入线位置恒等于实际插入位置。
 */
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode, Slice } from "@tiptap/pm/model";

/** view.dragging 的运行时形态（node 为 dragstart 时记录的选区，多块拖拽时不存在） */
interface DraggingState {
  slice: Slice;
  move: boolean;
  node?: { from: number; to: number; empty: boolean };
}

/** 自动滚动：距滚动容器边缘多少像素内开始滚动 */
const AUTO_SCROLL_EDGE = 48;
/** 自动滚动最大速度（px/帧） */
const AUTO_SCROLL_MAX_SPEED = 14;
/** 插入线在无有效落点时的最小宽度兜底（px） */
const MIN_LINE_WIDTH = 8;

/** 判断是否为"闭合块 slice"（整块拖拽，openStart/openEnd 均为 0） */
function isClosedBlockSlice(slice: Slice): boolean {
  return (
    slice.openStart === 0 &&
    slice.openEnd === 0 &&
    slice.content.childCount > 0 &&
    slice.content.firstChild!.isBlock
  );
}

/** DOM 元素是否实际可滚动（overflow 允许且内容超出） */
function isScrollable(el: HTMLElement): boolean {
  const overflowY = getComputedStyle(el).overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") return false;
  return el.scrollHeight > el.clientHeight + 1;
}

/** 从编辑器 DOM 向上寻找最近的滚动容器（编辑器自身 wrapper 或外层页面容器） */
function findScrollContainer(view: EditorView): HTMLElement | null {
  let el: HTMLElement | null = view.dom;
  while (el) {
    if (isScrollable(el)) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * 手柄当前悬停的块（由 `handleNodeChange` 维护，供"添加块"按钮定位插入点）。
 * 官方扩展在手柄隐藏时回调 `onNodeChange({ node: null, pos: -1 })`，届时置空。
 */
let hoveredBlock: { editor: Editor; node: PMNode; pos: number } | null = null;

/**
 * 浮层抑制标志：dragstart（capture，先于官方扩展的 dragstart handler）置位，
 * 拖拽物理结束（drop/dragend）后**保持**，直到出现真正的用户交互才清除：
 * - pointerdown / keydown：用户开始新操作（点击、按键）；
 * - 有实际位移的 mousemove：用户主动移动鼠标（区别于 drop 后浏览器在光标处
 *   合成的无位移 mousemove/mouseover），解除后 hover 交互恢复正常；
 * - 任一编辑器的空选区事务：选区已收拢，"非空选区"显示条件自然失效。
 *
 * 不能在 drop/dragend 后立即（setTimeout 0）清除：BubbleMenuView 的 update 在选区
 * 非空时走 250ms 防抖（handleDebouncedUpdate），官方扩展 drop 后派发的"恢复选区"
 * 事务（覆盖被拖块的非空 NodeRangeSelection）要到约 drop+250ms 才重算 shouldShow；
 * 届时标志已清除、选区仍非空，悬浮菜单会再次弹出。
 */
let menuSuppressedByDrag = false;

/** 拖拽物理进行中（dragstart → drop/dragend），用于区分"拖拽中"与"拖拽后等待交互" */
let dragActive = false;

/** dragend 时的鼠标坐标：其后首个有实际位移的 mousemove 解除抑制 */
let mouseAtDragEnd: { x: number; y: number } | null = null;

/** 浮层是否处于拖拽抑制期（供文本/图片悬浮菜单 shouldShow / setHover 抑制显示） */
export function isDraggingBlock(): boolean {
  return menuSuppressedByDrag;
}

/**
 * 拖拽结束后把选区收拢为光标（落在被拖块起始处）。
 * 官方扩展在 drop 后会恢复出覆盖被拖块的非空选区（NodeRangeSelection），这是
 * "非空选区 → 浮层弹出"的根源；收拢后 250ms 防抖重算时 from === to，浮层自然隐藏。
 * 仅对由本编辑器拖拽手柄发起的拖拽生效，避免误伤用户此前做出的选区。
 */
function collapseSelectionToCaret(view: EditorView): void {
  if (!view.editable || !view.dom.isConnected) return;
  const { state } = view;
  if (state.selection.empty) return;
  const pos = Math.min(Math.max(state.selection.from, 0), state.doc.content.size);
  const caret = TextSelection.near(state.doc.resolve(pos), 1);
  if (caret.eq(state.selection)) return;
  view.dispatch(state.tr.setSelection(caret));
}

/**
 * 供 `DragHandle.configure({ onNodeChange })`：记录手柄当前悬停的块。
 * 说明：运行时始终传 `{ editor, node, pos }`（隐藏时 node 为 null、pos 为 -1），
 * 但扩展的 TS 类型只声明了 `{ editor, node }`，故 pos 按可选接收。
 */
export function handleNodeChange(p: { editor: Editor; node: PMNode | null; pos?: number }): void {
  if (!p.node || typeof p.pos !== "number" || p.pos < 0) {
    hoveredBlock = null;
    return;
  }
  hoveredBlock = { editor: p.editor, node: p.node, pos: p.pos };
}

/** 在当前悬停块下方插入空段落并聚焦（"添加块"按钮点击） */
function insertBlockBelow(): void {
  const block = hoveredBlock;
  if (!block || block.editor.isDestroyed) return;
  const end = block.pos + block.node.nodeSize;
  block.editor
    .chain()
    .focus()
    .insertContentAt(end, { type: "paragraph" })
    .setTextSelection(end + 1)
    .run();
}

/**
 * 滚动时隐藏手柄：手柄用 fixed 视口定位，内容滚动后坐标失效。
 * 通过官方扩展的 "hideDragHandle" meta 隐藏（内部会重置 currentNode，
 * 鼠标恢复移动即可重新显示并重定位），无需自行维护显隐。
 */
function hideHandleOnScroll(): void {
  const block = hoveredBlock;
  if (!block || block.editor.isDestroyed) return;
  block.editor.view.dispatch(block.editor.state.tr.setMeta("hideDragHandle", true));
}

/**
 * 接管官方扩展的手柄定位：官方 computePosition 以 absolute 策略计算，
 * 但本项目 Naive UI 滚动布局下手柄 wrapper 的 offsetParent 参照链错乱，
 * 实测手柄会偏移一个滚动量。这里改用 fixed 视口坐标直接对齐块：
 * 顶边与块顶对齐、右缘（含 .drag-handle 的 padding-right 透明桥接区）紧贴块左缘。
 *
 * 左缘夹取：手柄整体宽度 48px（两个 20px 按钮 + 8px 桥接区），各编辑容器在
 * ProseMirror 左右对称预留 48px（$spacing-2xl）内边距，左侧即手柄槽位，
 * 手柄悬停时浮现在槽位内（右侧留白对称，视觉平衡）；左缘以 view.dom
 * （ProseMirror 内容根）左缘为下界夹取，保证手柄永不溢出编辑区
 * （日志卡片外的页面留白 / 章节编辑器侧栏方向）。
 *
 * 间距由 .drag-handle 的 padding-right（8px）实现而非在此处留间隙：
 * 早期版本用 `rect.left - offsetWidth - 12` 留间隙，间隙下方是官方扩展 wrapper
 * （pointer-events: none），鼠标从块移到手柄时 mouseleave 的 relatedTarget
 * 穿透 wrapper 指向 parentElement，官方判定 !wrapper.contains(relatedTarget)
 * 为 true 直接隐藏手柄，手柄无法选中。改为 padding-right 后，element 可命中区
 * 与块左缘连续相接，relatedTarget 恒为 element（wrapper 的 DOM 子节点），不触发隐藏。
 */
function takeoverPosition(element: HTMLElement): void {
  const block = hoveredBlock;
  if (!block || block.editor.isDestroyed || !element.isConnected) return;
  const view = block.editor.view;
  const dom = view.nodeDOM(block.pos);
  if (!dom || dom.nodeType !== 1) return;
  const rect = (dom as HTMLElement).getBoundingClientRect();
  // 编辑区（ProseMirror 内容根）左缘：手柄槽位的硬边界
  const editorLeft = view.dom.getBoundingClientRect().left;
  element.style.position = "fixed";
  // element.offsetWidth 含 padding-right（透明桥接区），右缘紧贴块左缘；
  // 槽位不足（如未预留内边距的容器）时夹取到编辑区左缘，宁可轻微覆盖
  // 块内容也不让手柄溢出编辑区
  const left = Math.max(rect.left - element.offsetWidth, editorLeft);
  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(rect.top)}px`;
}

/**
 * 手柄渲染函数："＋ 添加块"按钮 + 六点 grip 图标（Notion 风格）
 * 显示/隐藏由官方扩展通过根节点 visibility + pointerEvents 控制；
 * 根节点整体可拖拽（dragstart 由官方扩展接管），点击"＋"仅插入不触发拖拽。
 */
export function renderDragHandle(): HTMLElement {
  const element = document.createElement("div");
  element.classList.add("drag-handle");
  element.setAttribute("data-drag-handle", "true");
  // 初始隐藏（与官方 hideHandle() 一致）：官方插件的 view() 初始化不隐藏 element，
  // wrapper 挂在编辑器容器左上角且 element 未定位——不隐藏的话页面渲染完成后手柄
  // 会直接出现在每个编辑器的首行位置（鼠标未悬浮也可见），直到首次 mouseleave/
  // 按键/滚动才消失。官方 showHandle() 在首次 mousemove 悬停块时会清除 visibility
  // 恢复显示，交互语义不变
  element.style.visibility = "hidden";

  // ＋ 添加块按钮：点击在当前块下方插入空段落
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "drag-handle-btn drag-handle__add";
  addBtn.title = "在下方添加块";
  addBtn.setAttribute("aria-label", "在下方添加块");
  addBtn.innerHTML =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M8 3.5v9M3.5 8h9"/></svg>';
  // 阻止 mousedown 默认行为（抢焦点/选区），避免点击按钮导致编辑器失焦闪烁
  addBtn.addEventListener("mousedown", (e) => e.preventDefault());
  addBtn.addEventListener("click", insertBlockBelow);

  // ⠿ 拖拽图标
  const grip = document.createElement("span");
  grip.className = "drag-handle-btn drag-handle__grip";
  grip.title = "拖拽移动";
  grip.innerHTML =
    '<svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden="true">' +
    '<circle cx="2.5" cy="2.5" r="1.3"/><circle cx="7.5" cy="2.5" r="1.3"/>' +
    '<circle cx="2.5" cy="8" r="1.3"/><circle cx="7.5" cy="8" r="1.3"/>' +
    '<circle cx="2.5" cy="13.5" r="1.3"/><circle cx="7.5" cy="13.5" r="1.3"/>' +
    "</svg>";

  element.append(addBtn, grip);

  // 定位接管：官方每次 repositionDragHandle 都会向 element.style 写入
  // absolute 坐标（mousemove 换块、文档更新时触发），MutationObserver 感知后
  // 改写为 fixed 视口坐标（takeoverPosition 内 position 值判断防递归触发）。
  // 注意：官方 view() 初始化时 element 尚未挂到 document（Vue 异步挂载），
  // 回调里不能因 isConnected 断开观察——observer 生命周期与 element 一致，
  // 编辑器销毁后官方不再写入 style，observer 自然停转，无泄漏。
  const styleObserver = new MutationObserver(() => {
    if (element.style.position !== "absolute") return;
    if (!element.isConnected) return;
    takeoverPosition(element);
  });
  styleObserver.observe(element, { attributes: true, attributeFilter: ["style"] });

  // fixed 视口定位的兜底：滚动后手柄坐标失效，隐藏之
  // （元素随编辑器销毁断连时自动解绑，避免监听器泄漏）
  const onScroll = (): void => {
    if (!element.isConnected) {
      document.removeEventListener("scroll", onScroll, true);
      return;
    }
    hideHandleOnScroll();
  };
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return element;
}

/**
 * 插入线扩展：拖拽期间显示蓝色水平插入线
 */
export const DropLine = Extension.create({
  name: "wrispDropLine",

  addProseMirrorPlugins() {
    return [createDropLinePlugin()];
  },
});

const dropLinePluginKey = new PluginKey("wrispDropLine");

function createDropLinePlugin() {
  return new Plugin({
    key: dropLinePluginKey,
    view(view: EditorView) {
      // 插入线挂在编辑器内容根节点（view.dom 的父级，随内容滚动）
      const host = view.dom.parentElement ?? document.body;
      const line = document.createElement("div");
      line.className = "wrisp-drop-line";
      line.style.display = "none";
      host.appendChild(line);

      let rafId: number | null = null;
      let mouse: { x: number; y: number } | null = null;
      let container: HTMLElement | null = null;

      function hideLine(): void {
        line.style.display = "none";
      }

      /** 将插入线渲染到文档位置 pos（顶层块边界） */
      function renderLineAt(pos: number): void {
        const { doc } = view.state;
        const $pos = doc.resolve(pos);
        const before = $pos.nodeBefore;
        const after = $pos.nodeAfter;

        let left = 0;
        let right = 0;
        let y = 0;
        let ok = false;

        if (after) {
          const dom = view.nodeDOM(pos) as HTMLElement | null;
          if (dom) {
            const rect = dom.getBoundingClientRect();
            left = rect.left;
            right = rect.right;
            y = rect.top;
            ok = true;
            // 相邻块间隙的中点更符合"插入到两者之间"的直觉
            if (before) {
              const beforeDom = view.nodeDOM(pos - before.nodeSize) as HTMLElement | null;
              if (beforeDom) {
                y = (beforeDom.getBoundingClientRect().bottom + rect.top) / 2;
              }
            }
          }
        } else if (before) {
          const dom = view.nodeDOM(pos - before.nodeSize) as HTMLElement | null;
          if (dom) {
            const rect = dom.getBoundingClientRect();
            left = rect.left;
            right = rect.right;
            y = rect.bottom;
            ok = true;
          }
        }

        if (!ok) {
          hideLine();
          return;
        }

        // 宽度夹在编辑器内容区内（适配缩进/图片等窄块），过窄时兜底为整行
        const editorRect = view.dom.getBoundingClientRect();
        left = Math.max(left, editorRect.left);
        right = Math.min(right, editorRect.right);
        if (right - left < MIN_LINE_WIDTH) {
          left = editorRect.left;
          right = editorRect.right;
        }

        line.style.display = "block";
        line.style.left = `${left}px`;
        line.style.top = `${y}px`;
        line.style.width = `${right - left}px`;
      }

      /** 基于当前鼠标坐标重算落点并更新插入线 */
      function updateLine(): void {
        const dragging = view.dragging as DraggingState | null;
        if (!mouse || !dragging || !dragging.slice || !view.editable) {
          hideLine();
          return;
        }
        const slice = dragging.slice;
        if (!isClosedBlockSlice(slice)) {
          // 行内文本拖拽等开放 slice：不显示横线（保持原生光标行为）
          hideLine();
          return;
        }
        const eventPos = view.posAtCoords({ left: mouse.x, top: mouse.y });
        if (!eventPos) {
          hideLine();
          return;
        }
        const target = dropPoint(view.state.doc, eventPos.pos, slice);
        if (target === null) {
          hideLine();
          return;
        }
        // 落点与原位置重合（拖回原处）：隐藏插入线提示"无变化"
        const range = dragging.node ?? view.state.selection;
        if (!range.empty && (target === range.from || target === range.to)) {
          hideLine();
          return;
        }
        renderLineAt(target);
      }

      /** 每帧：边缘自动滚动 + 插入线重算（滚动后内容随指针移动） */
      function tick(): void {
        if (mouse && container) {
          const rect = container.getBoundingClientRect();
          let delta = 0;
          if (mouse.y < rect.top + AUTO_SCROLL_EDGE) {
            const depth = Math.min(1, (rect.top + AUTO_SCROLL_EDGE - mouse.y) / AUTO_SCROLL_EDGE);
            delta = -Math.max(1, AUTO_SCROLL_MAX_SPEED * depth);
          } else if (mouse.y > rect.bottom - AUTO_SCROLL_EDGE) {
            const depth = Math.min(1, (mouse.y - (rect.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
            delta = Math.max(1, AUTO_SCROLL_MAX_SPEED * depth);
          }
          if (delta !== 0 && container.scrollTop + delta >= 0) {
            container.scrollTop += delta;
          }
        }
        updateLine();
        rafId = window.requestAnimationFrame(tick);
      }

      function stopLoop(): void {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
      }

      function cleanup(): void {
        stopLoop();
        hideLine();
        mouse = null;
        container = null;
      }

      function onDocDragOver(event: DragEvent): void {
        mouse = { x: event.clientX, y: event.clientY };
        const dragging = view.dragging as DraggingState | null;
        if (!dragging || !(event.target instanceof Node) || !view.dom.contains(event.target)) {
          // 指针不在编辑器内容区：隐藏插入线
          hideLine();
          return;
        }
        if (container === null) {
          container = findScrollContainer(view);
        }
        if (rafId === null) {
          rafId = window.requestAnimationFrame(tick);
        }
      }

      // 本次拖拽是否由本编辑器的拖拽手柄发起（dragend 后据此收拢选区）
      let handleDragOrigin = false;

      /** capture 置位抑制标志：先于官方扩展的 dragstart handler（含选区事务派发）执行 */
      function onDocDragStart(e: DragEvent): void {
        dragActive = true;
        menuSuppressedByDrag = true;
        const target = e.target;
        handleDragOrigin =
          target instanceof Element &&
          target.closest("[data-drag-handle]") !== null &&
          view.dom.parentElement?.contains(target) === true;
      }

      function onDocDrop(): void {
        cleanup();
        dragActive = false;
      }

      /**
       * 拖拽物理结束（dragend 必然晚于 drop，此时官方的移动/恢复选区事务均已派发完成）：
       * 记录鼠标坐标供后续位移判定，并把本编辑器拖拽手柄发起的非空选区收拢为光标。
       */
      function onDocDragEnd(e: DragEvent): void {
        cleanup();
        dragActive = false;
        mouseAtDragEnd = { x: e.clientX, y: e.clientY };
        if (handleDragOrigin) {
          handleDragOrigin = false;
          collapseSelectionToCaret(view);
        }
      }

      /** 用户重新交互（pointerdown / keydown）：解除浮层抑制 */
      function onUserInteract(): void {
        if (menuSuppressedByDrag && !dragActive) menuSuppressedByDrag = false;
      }

      /**
       * 有实际位移的 mousemove 解除抑制。
       * drop 后浏览器会在光标处合成无位移的 mousemove/mouseover（用于刷新 hover 态），
       * 不能据此解除——否则合成 mouseover 会立刻触发图片浮层（meta "show" 绕过 shouldShow）。
       */
      function onUserMouseMove(e: MouseEvent): void {
        if (!menuSuppressedByDrag || dragActive || !mouseAtDragEnd) return;
        if (e.clientX !== mouseAtDragEnd.x || e.clientY !== mouseAtDragEnd.y) {
          menuSuppressedByDrag = false;
          mouseAtDragEnd = null;
        }
      }

      document.addEventListener("dragover", onDocDragOver);
      document.addEventListener("dragstart", onDocDragStart, true);
      document.addEventListener("drop", onDocDrop);
      document.addEventListener("dragend", onDocDragEnd);
      document.addEventListener("pointerdown", onUserInteract, true);
      document.addEventListener("keydown", onUserInteract, true);
      document.addEventListener("mousemove", onUserMouseMove);

      return {
        update() {
          // 拖拽结束后出现空选区（含收拢事务自身）：抑制解除
          if (menuSuppressedByDrag && !dragActive && view.state.selection.empty) {
            menuSuppressedByDrag = false;
          }
        },
        destroy() {
          cleanup();
          document.removeEventListener("dragover", onDocDragOver);
          document.removeEventListener("dragstart", onDocDragStart, true);
          document.removeEventListener("drop", onDocDrop);
          document.removeEventListener("dragend", onDocDragEnd);
          document.removeEventListener("pointerdown", onUserInteract, true);
          document.removeEventListener("keydown", onUserInteract, true);
          document.removeEventListener("mousemove", onUserMouseMove);
          line.remove();
        },
      };
    },
  });
}
