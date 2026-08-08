<template>
  <n-flex class="block-editor" :class="{ 'is-dragging': isDragging }">
    <!-- 拖拽手柄 -->
    <div
      class="drag-handle"
      @mousedown="handleDragStart"
      :title="t('EDITOR.BLOCK_EDITOR.DRAG_HANDLE')"
    >
      <n-icon size="14">
        <BagHandle />
      </n-icon>
    </div>

    <!-- TODO 状态循环 -->
    <n-checkbox
      v-if="showTodo"
      :checked="todoDone"
      @update:checked="handleTodoToggle"
      :class="{ 'todo-done': todoDone }"
    />

    <!-- 行内编辑区域 -->
    <div
      class="editor-content"
      contenteditable
      @input="handleInput"
      @blur="handleBlur"
      v-text="content"
    />
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NFlex, NIcon, NCheckbox } from "naive-ui";
import { BagHandle } from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    content?: string;
    showTodo?: boolean;
    todoDone?: boolean;
  }>(),
  {
    content: "",
    showTodo: false,
    todoDone: false,
  },
);

const emit = defineEmits<{
  (e: "update:content", value: string): void;
  (e: "update:todoDone", value: boolean): void;
  (e: "dragStart"): void;
}>();

const isDragging = ref(false);

function handleInput(ev: Event): void {
  const target = ev.target as HTMLElement;
  emit("update:content", target.textContent || "");
}

function handleBlur(): void {
  // 占位：失去焦点处理
}

function handleTodoToggle(val: boolean): void {
  emit("update:todoDone", val);
}

function handleDragStart(): void {
  isDragging.value = true;
  emit("dragStart");

  const handleMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener("mouseup", handleMouseUp);
  };
  document.addEventListener("mouseup", handleMouseUp);
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.block-editor {
  align-items: center;
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-sm;
  gap: $spacing-sm;

  &:hover {
    background-color: var(--bg-secondary);
  }

  &.is-dragging {
    opacity: 0.5;
  }
}

.drag-handle {
  cursor: grab;
  color: var(--text-quaternary);
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: $radius-xs;

  &:hover {
    color: var(--text-secondary);
    background-color: var(--bg-tertiary);
  }
}

.editor-content {
  flex: 1;
  min-width: 0;
  outline: none;
  padding: 2px 0;
  line-height: 1.6;
  word-break: break-word;
}

.todo-done {
  text-decoration: line-through;
  color: var(--text-quaternary);
}
</style>