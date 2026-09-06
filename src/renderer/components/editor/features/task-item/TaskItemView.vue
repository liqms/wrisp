<template>
  <NodeViewWrapper as="li" class="task-item-node">
    <!-- 勾选框：mousedown 阻止默认（防编辑器抢焦点，同官方 NodeView），
         change 统一处理鼠标与键盘（Space）两种切换路径。
         日期等行内内容不设专属属性：任务里通过斜杠命令插入 [[日期]]，
         与正文统一由 inline-sem Decoration 渲染药丸 -->
    <label class="task-item-checkbox" contenteditable="false" :title="t('EDITOR.TASK_ITEM.TOGGLE_CHECKED_TITLE')"
      @mousedown.prevent>
      <input type="checkbox" :checked="props.node.attrs.checked" @change="onCheckboxChange" />
    </label>
    <!-- ProseMirror 内容区（contentDOM） -->
    <NodeViewContent as="div" class="task-item-text" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import { i18n } from "@/renderer/plugins/i18n";

// 与 datePicker.ts 相同的取译法（不依赖组件级 i18n 上下文，NodeView 挂载更稳）
const t = i18n.global.t as (key: string) => string;
const props = defineProps(nodeViewProps);

/** 勾选框 change（鼠标点击 / 键盘 Space 均触发）：切换完成状态 */
function onCheckboxChange(e: Event): void {
  props.updateAttributes({ checked: (e.target as HTMLInputElement).checked });
}
</script>
