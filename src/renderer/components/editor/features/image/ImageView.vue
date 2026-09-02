<template>
  <NodeViewWrapper as="span" class="image-node" :class="[align ? `image-align-${align}` : null]">
    <!-- figure（display:table）：宽度收缩到图片实际宽度；caption（table-caption）
         与图片同宽并固定在下方——holder/caption 原为同级 inline-block，会排在同一行
         导致描述出现在图片旁边、编辑输入框宽度塌缩 -->
    <span class="image-figure">
      <span class="image-node__holder" :class="{ 'is-selected': selected, 'is-hovered': hovered }" :style="imageStyle"
        @mouseenter="hovered = true" @mouseleave="hovered = false" @mousedown.stop="onHolderMouseDown">
        <img ref="imgRef" class="image-node__img" :src="src" :alt="alt || ''" draggable="false" @load="onLoad" />

        <!-- 左右缩放手柄（hover / 选中时显示） -->
        <span v-if="!dragging" class="image-resize-handle image-resize-handle--left" title="拖动调整宽度"
          @mousedown.stop.prevent="onResizeStart($event, 'left')" />
        <span v-if="!dragging" class="image-resize-handle image-resize-handle--right" title="拖动调整宽度"
          @mousedown.stop.prevent="onResizeStart($event, 'right')" />

        <!-- 拖动中：竖线指示器 + 宽度提示 -->
        <template v-if="dragging">
          <span class="image-drag-line" :class="`image-drag-line--${dragSide}`" />
          <span class="image-drag-size" :class="`image-drag-size--${dragSide}`">{{ currentWidth }} px</span>
        </template>
      </span>

      <!-- 图片描述（caption）：alt 非空显示文本，编辑态显示输入框（宽度=图片宽度） -->
      <span v-if="editingCaption" class="image-caption image-caption--editing">
        <input ref="captionInputRef" class="image-caption__input" type="text" :value="captionText"
          :placeholder="t('EDITOR.IMAGE_CAPTION_PLACEHOLDER')" @mousedown.stop @keydown.enter.prevent="commitCaption"
          @keydown.esc.prevent="cancelCaption" @blur="commitCaptionOnBlur" />
      </span>
      <span v-else-if="captionText" class="image-caption" :title="t('EDITOR.IMAGE_CAPTION_EDIT')"
        @mousedown.stop="startEditCaption">
        {{ captionText }}
      </span>
    </span>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import { useI18n } from "vue-i18n";
import { IMAGE_WIDTH_MAX, IMAGE_WIDTH_MIN } from "./image-extension";

const props = defineProps(nodeViewProps);
const { t } = useI18n();

const imgRef = ref<HTMLImageElement | null>(null);
const captionInputRef = ref<HTMLInputElement | null>(null);
const naturalWidth = ref<number>(0);
const naturalHeight = ref<number>(0);
const hovered = ref(false);
const editingCaption = ref(false);

const src = computed(() => String(props.node.attrs.src ?? ""));
const alt = computed(() => props.node.attrs.alt);
const align = computed<"left" | "center" | "right" | null>(() => {
  const v = props.node.attrs.align;
  return v === "left" || v === "center" || v === "right" ? v : null;
});
const widthAttr = computed<number | null>(() => {
  const v = props.node.attrs.width;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
});
const selected = computed(() => props.selected);

/** null=无描述；非空字符串=描述文本（空串同 null 处理） */
const captionText = computed<string>(() => {
  const v = alt.value;
  return v == null ? "" : String(v);
});

const currentWidth = ref<number>(widthAttr.value ?? 0);
watch(
  () => widthAttr.value,
  (v) => {
    if (v === null) {
      // width 属性被清除（重置原始尺寸）：置 0 表示"无显式宽度"，
      // 由 CSS（max-width:100%; height:auto）按容器约束自然渲染；
      // 不能写入自然宽度内联样式——大图会把布局撑爆（holder/caption 溢出编辑器）
      currentWidth.value = 0;
      return;
    }
    if (v !== currentWidth.value) currentWidth.value = v;
  },
);
// 浮层"添加/编辑描述"通过事务 meta（imageCaptionEdit: pos）通知本 NodeView 进入编辑态，
// 文档内不落任何编辑占位值（alt 仅存 null 或最终文本）
const onCaptionEditTransaction = (p: { transaction: Transaction }) => {
  const target = p.transaction.getMeta("imageCaptionEdit");
  if (typeof target !== "number") return;
   
  console.log("[img-debug] 收到 imageCaptionEdit meta:", target, "本节点 pos:", props.getPos());
  if (target !== (props.getPos() as number)) return;
  editingCaption.value = true;
};
props.editor.on("transaction", onCaptionEditTransaction);

// 仅当有显式宽度（width 属性或拖拽中）才写内联样式；
// 未设置宽度时不写（含图片加载后），避免自然宽度超过容器时溢出布局。
// caption 无需单独设宽：table-caption 宽度自动绑定 figure（=图片宽度）
const imageStyle = computed(() => {
  const w = currentWidth.value;
  return w > 0 ? { width: `${Math.round(w)}px` } : {};
});

watch(editingCaption, async (v) => {
  if (v) {
    await nextTick();
    captionInputRef.value?.focus();
  }
});

function onLoad() {
  const el = imgRef.value;
  if (!el) return;
  // 仅记录自然尺寸（用于 clampWidth 上限与"查看原图"）；
  // 不回写 currentWidth：无显式 width 时交给 CSS 约束渲染，
  // 写入自然宽度会导致大图以 px 内联宽度溢出编辑器
  naturalWidth.value = el.naturalWidth;
  naturalHeight.value = el.naturalHeight;
}

function onHolderMouseDown() {
  // 点击图片时选中图片节点（原子节点，NodeSelection）
  const { editor, getPos } = props;
  const pos = getPos();
  if (typeof pos !== "number") return;
  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos));
  editor.view.dispatch(tr);
  editor.commands.focus();
}

// ── 描述（caption）编辑 ──
function startEditCaption() {
  editingCaption.value = true;
}

function updateCaption(value: string | null) {
  const { editor, getPos } = props;
  const pos = getPos();
  if (typeof pos !== "number") return;
  editor.commands.command(({ tr }) => {
    tr.setNodeMarkup(pos, undefined, {
      ...props.node.attrs,
      alt: value,
    });
    return true;
  });
}

function commitCaption() {
  if (!editingCaption.value) return;
  const el = captionInputRef.value;
  const value = (el?.value ?? "").trim();
  // 空描述保存为 null（无描述态）；非空文本持久化到文档
  updateCaption(value || null);
  editingCaption.value = false;
  // Enter 提交后光标回到文档，避免编辑器停留在失焦态
  props.editor.commands.focus();
}

/** blur 提交（点击输入框外部）：不回焦——焦点由用户点击的目标自然接管，强行回焦会抢走焦点 */
function commitCaptionOnBlur() {
  if (!editingCaption.value) return;
  const el = captionInputRef.value;
  const value = (el?.value ?? "").trim();
  updateCaption(value || null);
  editingCaption.value = false;
}

function cancelCaption() {
  editingCaption.value = false;
  props.editor.commands.focus();
}

// ── 拖拽缩放（左右手柄，Notion 式交互） ──
let dragState: {
  side: "left" | "right";
  startX: number;
  startWidth: number;
} | null = null;

const dragging = ref(false);
const dragSide = ref<"left" | "right">("right");

function onResizeStart(e: MouseEvent, side: "left" | "right") {
  // 以实际渲染宽度为拖拽基线：width 属性可能为 null（CSS 约束渲染），
  // 或显式宽度大于当前容器（被 max-width 钳制），用户看到的都是 clientWidth
  const startWidth = (imgRef.value?.clientWidth ?? 0) || currentWidth.value;
  if (!startWidth) return;
  // 同步 currentWidth，让拖动提示与内联样式从真实渲染宽度起步（无视觉跳变）
  if (currentWidth.value !== startWidth) currentWidth.value = startWidth;
  dragState = { side, startX: e.clientX, startWidth };
  dragSide.value = side;
  dragging.value = true;

  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", onResizeEnd);
  document.body.style.cursor = "ew-resize";
  document.body.style.userSelect = "none";
}

/** 编辑器内容区宽度（扣除内边距）；布局不可用时返回 0 */
function editorContentWidth(): number {
  const dom = props.editor.view?.dom as HTMLElement | undefined;
  if (!dom) return 0;
  const cs = window.getComputedStyle(dom);
  const w =
    dom.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
  return Number.isFinite(w) && w > 0 ? w : 0;
}

function clampWidth(w: number): number {
  // 上限取三者最小：全局上限、图片原始分辨率、编辑器内容区宽度
  //（钳到容器宽可保证"记录到文档的宽度 = 实际展示的宽度"）
  const containerW = editorContentWidth();
  const maxW = Math.min(
    IMAGE_WIDTH_MAX,
    naturalWidth.value || IMAGE_WIDTH_MAX,
    containerW > 0 ? containerW : IMAGE_WIDTH_MAX,
  );
  return Math.round(Math.max(IMAGE_WIDTH_MIN, Math.min(maxW, w)));
}

function onResizeMove(e: MouseEvent) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  // 左手柄向左拖 → 变宽（dx 为负）；右手柄向右拖 → 变宽
  const raw = dragState.side === "right"
    ? dragState.startWidth + dx
    : dragState.startWidth - dx;
  currentWidth.value = clampWidth(raw);
}

function onResizeEnd() {
  if (!dragState) return;
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", onResizeEnd);
  document.body.style.cursor = "";
  document.body.style.userSelect = "";

  const { editor, getPos, node } = props;
  const pos = getPos();
  if (typeof pos === "number") {
    editor.commands.command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        width: currentWidth.value,
      });
      return true;
    });
  }
  dragState = null;
  dragging.value = false;
}

onBeforeUnmount(() => {
  props.editor.off("transaction", onCaptionEditTransaction);
  if (dragState) {
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
});
</script>

<style scoped lang="scss">
.image-node {
  display: block;
  margin: 6px 0;
  width: 100%;

  // figure 为块级 table（对 text-align 不生效），对齐用自动边距实现：
  // 默认/左对齐 = margin-right:auto，居中 = 左右 auto，右对齐 = margin-left:auto
  &.image-align-center .image-figure {
    margin-left: auto;
    margin-right: auto;
  }

  &.image-align-right .image-figure {
    margin-left: auto;
  }
}

// 收缩到内容（图片）宽度；caption-side 把描述固定在下方
.image-figure {
  display: table;
  caption-side: bottom;
  max-width: 100%;
}

.image-node__holder {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
  border-radius: 2px;
  cursor: pointer;

  &.is-selected {
    outline: 2px solid var(--primary-color);
    outline-offset: 1px;
  }
}

.image-node__img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 2px;
  user-select: none;
}

// ── 左右缩放手柄（hover / 选中时显示） ──
.image-resize-handle {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 32px;
  margin-top: -16px;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid #fcfcfc;
  border-radius: 3px;
  opacity: 0;
  cursor: ew-resize;
  transition: opacity 120ms ease;
  z-index: 2;

  .image-node__holder.is-hovered &,
  .image-node__holder.is-selected & {
    opacity: 0.85;

    &:hover {
      opacity: 1;
      transform: scaleY(1.1);
    }
  }

  &--left {
    left: 4px;
  }

  &--right {
    right: 4px;
  }
}

// ── 拖动中的竖线指示器 ──
.image-drag-line {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: var(--primary-color);
  border-radius: 1px;
  z-index: 3;
  pointer-events: none;

  &--left {
    left: -1px;
  }

  &--right {
    right: -1px;
  }
}

// ── 拖动中的宽度提示 ──
.image-drag-size {
  position: absolute;
  top: -30px;
  padding: 2px 8px;
  background: var(--primary-color);
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: "Consolas", monospace;
  line-height: 18px;
  white-space: nowrap;
  z-index: 3;
  pointer-events: none;

  &--left {
    left: 0;
  }

  &--right {
    right: 0;
  }
}

// ── 图片描述（caption）：table-caption 宽度自动绑定 figure（=图片宽度），
// 长文本在图片宽度内换行（最宽不超过最长单词） ──
.image-caption {
  display: table-caption;
  padding: 4px 4px 2px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  text-align: center;
  word-break: break-word;
  border-radius: 3px;
  cursor: text;
  transition: background 100ms ease, color 100ms ease;

  &:hover {
    background: rgba(90, 142, 232, 0.1);
    color: var(--text-tertiary);
  }

  &--editing {
    padding: 4px 0 0;
    cursor: text;
  }
}

.image-caption__input {
  width: 100%;
  padding: 2px 6px;
  border: 1px solid #5a8ee8;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-family: inherit;
  line-height: 1.5;
  outline: none;

  &::placeholder {
    color: #b0b0b0;
  }
}
</style>
