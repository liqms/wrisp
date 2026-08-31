<template>
  <BlockEditModal :visible="visible" :node-type="nodeType" :attrs="attrs" @update:visible="onVisible"
    @save="onSave" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { blockEditState, closeBlockEditor } from "./bus";
import BlockEditModal from "./BlockEditModal.vue";

/** 全局唯一的块编辑宿主：消费总线上的编辑请求并落盘保存 */
const request = computed(() => blockEditState.value);

const visible = computed(() => request.value !== null);
const nodeType = computed(() => request.value?.nodeType ?? "");
const attrs = computed(() => request.value?.attrs ?? {});

function onVisible(value: boolean): void {
  if (!value) closeBlockEditor();
}

function onSave(newAttrs: Record<string, string>): void {
  const current = request.value;
  if (!current) return;

  const { editor, pos, nodeType } = current;
  try {
    // 弹窗打开期间文档可能被 undo/redo 改动，保存前校验 pos 处仍是目标块
    const node = editor.state.doc.nodeAt(pos);
    if (node && node.type.name === nodeType) {
      const tr = editor.state.tr.setNodeMarkup(pos, undefined, newAttrs);
      editor.view.dispatch(tr);
    }
  } finally {
    closeBlockEditor();
  }
}
</script>
