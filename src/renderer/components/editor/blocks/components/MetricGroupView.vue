<template>
  <NodeViewWrapper class="metric-group-wrap" :class="{ selected }">
    <span v-show="addVisible" ref="addBtnRef" class="metric-group__add" :style="addStyle"
      :title="t('EDITOR.BLOCKS.METRIC.ADD_CARD')"
      @click.stop="addCard" @mousedown.prevent>
      <n-icon :component="AddFilled" :size="16" />
    </span>
    <NodeViewContent class="metric-group" as="div" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { NodeViewWrapper, NodeViewContent, nodeViewProps } from "@tiptap/vue-3";
import { AddFilled } from "@vicons/material";
import { openBlockEditor } from "./bus";

const props = defineProps(nodeViewProps);

const { t } = useI18n();

/**
 * 在分组末尾追加一张默认卡片并打开编辑弹窗。
 * 卡片类型由分组内容规则（content: "metric*"）推导，
 * 默认 attrs 由节点 schema 的 attribute defaults 提供（cardType.create({})）。
 */
function addCard(): void {
  const editor = props.editor;
  const pos = props.getPos?.();
  if (!editor || typeof pos !== "number") return;

  const groupNode = editor.state.doc.nodeAt(pos);
  const cardType = groupNode?.type.contentMatch.defaultType;
  if (!groupNode || !cardType) return;

  // 内容末尾（group 关闭标记之前）插入
  const end = pos + 1 + groupNode.content.size;
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.insert(end, cardType.create({}));
      return true;
    })
    .run();
  openBlockEditor({ editor, pos: end, nodeType: cardType.name, attrs: {} });
}

/** 「添加卡片」按钮定位参数：与 .metric-group__add 尺寸、.metric-group 列间距保持一致 */
const BTN_SIZE = 20;
const COL_GAP = 12;

const addBtnRef = ref<HTMLElement | null>(null);
const addVisible = ref(false);
const addStyle = ref<{ left: string; top: string }>({ left: "0px", top: "0px" });

let groupEl: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;

/**
 * 重算「添加卡片」按钮位置：显示在最后一张卡片之后（行内垂直居中）。
 * 无卡片、或最后一张卡所在行已满（按钮将落到新的一行）时隐藏。
 * 按钮绝对定位于分组 wrap，卡片 offsetLeft/Top 的 offsetParent 同为 wrap，坐标系一致。
 */
function updateAddButton(): void {
  const group = groupEl;
  if (!group) return;

  const lastCard = group.lastElementChild as HTMLElement | null;
  const remaining = lastCard
    ? group.clientWidth - (lastCard.offsetLeft + lastCard.offsetWidth)
    : 0;
  if (!lastCard || remaining < BTN_SIZE + COL_GAP) {
    addVisible.value = false;
    return;
  }

  addVisible.value = true;
  addStyle.value = {
    left: `${lastCard.offsetLeft + lastCard.offsetWidth + COL_GAP}px`,
    top: `${lastCard.offsetTop + (lastCard.offsetHeight - BTN_SIZE) / 2}px`,
  };
}

onMounted(() => {
  const wrap = addBtnRef.value?.closest(".metric-group-wrap") ?? null;
  groupEl = (wrap?.querySelector(".metric-group") as HTMLElement | null) ?? null;
  if (groupEl && typeof ResizeObserver !== "undefined") {
    // 卡片增删、编辑器宽度变化都会改变分组尺寸，统一由此触发重算
    resizeObserver = new ResizeObserver(() => updateAddButton());
    resizeObserver.observe(groupEl);
  }
  // 挂载时 PM 子节点可能尚未插入 contentDOM，等 DOM 更新后再定位
  nextTick(updateAddButton);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  groupEl = null;
});

// 兜底：增删卡片但分组整体尺寸不变时（如单行内 2 卡删 1 卡），由 node 引用变化触发
watch(() => props.node, () => nextTick(updateAddButton));
</script>

<style lang="scss" scoped>
.metric-group-wrap {
  position: relative;
  display: block;
  margin: 4px 0;
  border-radius: 4px;
  transition: box-shadow 0.15s ease;

  // 块选中（Esc / 全选到分组节点）时的视觉反馈，与 MetricCard 选中样式一致
  &.selected {
    box-shadow: 0 0 0 1px var(--primary-color);
  }
}

.metric-group__add {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
  z-index: 1;

  .metric-group-wrap:hover & {
    opacity: 1;
  }

  &:hover {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
}

.metric-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  row-gap: 16px;

  :deep(.metric-card-wrap) {
    flex: 1 1 calc((100% - 2 * 12px) / 3);
    max-width: calc((100% - 2 * 12px) / 3);
    min-width: 0;
    margin: 0;
  }
}
</style>
