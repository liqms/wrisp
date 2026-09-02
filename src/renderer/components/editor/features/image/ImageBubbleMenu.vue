<template>
  <BubbleMenu v-if="editor" :editor="editor" :should-show="shouldShow" :options="{ placement: 'top', offset: 8 }"
    class="image-bubble-menu" :plugin-key="imageBubblePluginKey">
    <div class="image-toolbar">
      <!-- 对齐 -->
      <button class="it-btn" :class="{ 'is-active': align === null }" title="左对齐（默认）" @click="setAlign(null)">
        <n-icon size="16">
          <FormatAlignLeftOutlined />
        </n-icon>
      </button>
      <button class="it-btn" :class="{ 'is-active': align === 'center' }" title="居中对齐" @click="setAlign('center')">
        <n-icon size="16">
          <FormatAlignCenterOutlined />
        </n-icon>
      </button>
      <button class="it-btn" :class="{ 'is-active': align === 'right' }" title="右对齐" @click="setAlign('right')">
        <n-icon size="16">
          <FormatAlignRightOutlined />
        </n-icon>
      </button>

      <span class="it-divider" />

      <button class="it-btn it-btn--wide" title="查看原图" @click="viewOriginal">
        <n-icon size="14">
          <ZoomInOutlined />
        </n-icon>
      </button>

      <span class="it-divider" />

      <!-- 描述 -->
      <button class="it-btn it-btn--wide" :title="hasCaption ? '编辑图片描述' : '添加图片描述'" @click="editCaption">
        <n-icon size="16">
          <NotesOutlined />
        </n-icon>
      </button>

      <!-- 替换 -->
      <button class="it-btn" title="替换图片" @click="replaceImage">
        <n-icon size="16">
          <ImageOutlined />
        </n-icon>
      </button>

      <!-- 删除 -->
      <button class="it-btn it-btn--danger" title="删除图片" @click="deleteImage">
        <n-icon size="16">
          <DeleteOutlined />
        </n-icon>
      </button>
    </div>

    <!-- 隐藏宿主：点击"查看原图"时程序化调用 NImage 的预览（Naive UI 大图查看器） -->
    <n-image ref="previewRef" class="image-preview-host" :src="previewSrc" :img-props="{ draggable: false }" />
  </BubbleMenu>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { BubbleMenu } from "@tiptap/vue-3/menus";
import { NIcon, NImage } from "naive-ui";
import {
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
  DeleteOutlined,
  ImageOutlined,
  ZoomInOutlined,
  NotesOutlined,
} from "@vicons/material";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { isDraggingBlock } from "@/renderer/components/editor/features/drag-reorder/drag-reorder";
import { handleApiError } from "@/renderer/utils/error.utils";

const props = defineProps<{
  editor: Editor | null;
}>();

type ImageAttrs = Record<string, unknown> & { width?: unknown; src?: unknown };

interface TargetImage {
  node: PMNode;
  pos: number;
  attrs: ImageAttrs;
}

// 独立 PluginKey：与文本工具栏的 textBubbleMenu 插件状态隔离，
// 避免 BubbleMenu 插件实例间相互覆盖 shouldShow 状态
const imageBubblePluginKey = new PluginKey("imageBubbleMenu");

// ── 编辑器状态响应化（ed.state/DOM 均非响应式，事务后驱动重算） ──
const tick = ref(0);
let offTransaction: (() => void) | null = null;

onMounted(() => {
  const ed = props.editor;
  if (!ed) return;
  const onTransaction = () => {
    // NodeView 的 Vue 渲染（width → 样式）在微任务后落地，届时再重算
    void Promise.resolve().then(() => {
      tick.value++;
    });
  };
  ed.on("transaction", onTransaction);
  offTransaction = () => ed.off("transaction", onTransaction);
});

onBeforeUnmount(() => {
  offTransaction?.();
  offTransaction = null;
});

// ── 目标图片解析（选中 > 光标邻接） ──
function getTargetImage(ed: Editor | null): TargetImage | null {
  if (!ed) return null;
  void tick.value; // 依赖编辑器事务驱动重算
  const { state } = ed;
  const sel = state.selection as unknown as {
    node?: { type?: { name?: string }; attrs?: ImageAttrs };
    from?: number;
  };
  if (sel.node?.type?.name === "image" && typeof sel.from === "number") {
    return { node: sel.node as unknown as PMNode, pos: sel.from, attrs: (sel.node.attrs ?? {}) as ImageAttrs };
  }
  if (state.selection.empty) {
    const n = state.doc.nodeAt(state.selection.from);
    if (n?.type.name === "image") {
      return { node: n, pos: state.selection.from, attrs: (n.attrs ?? {}) as ImageAttrs };
    }
  }
  return null;
}

// ── 派生状态 ──
const align = computed<"left" | "center" | "right" | null>(() => {
  const attrs = getTargetImage(props.editor)?.attrs;
  const v = attrs?.align;
  return v === "center" || v === "right" ? v : null;
});

const previewSrc = computed<string>(() => {
  const attrs = getTargetImage(props.editor)?.attrs;
  return typeof attrs?.src === "string" ? attrs.src : "";
});

const hasCaption = computed<boolean>(() => {
  const attrs = getTargetImage(props.editor)?.attrs;
  return attrs?.alt != null;
});

const previewRef = ref<{ showPreview: () => void } | null>(null);

// ── 操作（统一 setNodeMarkup 到目标 pos，hover 无选区时也能生效） ──
function setAttrs(ed: Editor, pos: number, node: PMNode, attrs: Record<string, unknown>) {
  ed.commands.command(({ tr }) => {
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      ...attrs,
    });
    return true;
  });
}

function setAlign(val: "left" | "center" | "right" | null) {
  const ed = props.editor;
  const info = getTargetImage(ed);
  if (!ed || !info) return;
  setAttrs(ed, info.pos, info.node, { align: val });
  ed.commands.focus();
}

/** 添加/编辑描述：通知目标图片 NodeView 进入描述编辑态（事务 meta） */
function editCaption() {
  const ed = props.editor;
  const info = getTargetImage(ed);
   
  console.log("[img-debug] editCaption 触发:", {
    hasEditor: !!ed,
    targetPos: info?.pos ?? null,
    selection: ed?.state ? ed.state.selection.constructor.name : "no-state",
  });
  if (!ed || !info) return;
  // 不改文档属性：通过事务 meta 通知目标图片的 NodeView 进入描述编辑态
  // （ImageView 监听 imageCaptionEdit meta，空描述提交时才写 alt=null/文本）
  ed.commands.command(({ tr }) => {
    tr.setMeta("imageCaptionEdit", info.pos);
    return true;
  });
}

/** 查看原图：调起 Naive UI 大图预览（缩放/旋转工具栏） */
function viewOriginal() {
  if (!previewSrc.value) return;
  previewRef.value?.showPreview();
}

async function replaceImage() {
  const ed = props.editor;
  const info = getTargetImage(ed);
  if (!ed || !info) return;
  const result = await window.electronAPI.attachment.importImage();
  if (!result.success) {
    handleApiError(result, true);
    return;
  }
  const imported = result.data;
  if (!imported || Array.isArray(imported)) return;
  setAttrs(ed, info.pos, info.node, {
    src: imported.url,
    alt: imported.fileName,
    width: null,
  });
  ed.commands.focus();
}

function deleteImage() {
  const ed = props.editor;
  const info = getTargetImage(ed);
  if (!ed || !info) return;
  ed.commands.command(({ tr }) => {
    tr.delete(info.pos, info.pos + info.node.nodeSize);
    return true;
  });
}

// ── bubble 显示与定位 ──
function shouldShow(p: {
  editor: Editor;
  view: EditorView;
  state: EditorState;
  from: number;
  to: number;
}): boolean {
  const { editor: ed } = p;
  // 拖拽抑制期（dragstart → 用户重新交互/空选区前）不显示：dragstart 会派发覆盖
  // 图片的非空节点选区事务，drop 后官方扩展还会恢复非空选区、且 BubbleMenu 的
  // update 有 250ms 防抖——不拦截的话 isActive("image") 为真，浮层会跟随弹出
  if (isDraggingBlock()) return false;
  // 仅选中图片时显示（悬浮不触发）
  return ed.isActive("image");
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.image-bubble-menu {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  z-index: $z-dropdown;
  width: max-content;
}

.image-preview-host {
  display: none;
}

.image-toolbar {
  display: flex;
  align-items: center;
  gap: 1px;
  height: 36px;
  padding: 0 4px;
  background: #2b2b2b;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  color: #c8c8c8;
}

.it-divider {
  width: 1px;
  height: 20px;
  background: #444;
  margin: 0 4px;
  flex-shrink: 0;
}

.it-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 28px;
  height: 28px;
  padding: 0 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #d0d0d0;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  &.is-active {
    color: #fff;
    background: rgba(90, 142, 232, 0.25);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &--wide {
    padding: 0 7px;
  }

  &--danger:hover:not(:disabled) {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.12);
  }
}
</style>
