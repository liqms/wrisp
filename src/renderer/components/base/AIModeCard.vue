<template>
  <n-tooltip placement="top" content-style="width: 300px;">
    <template #trigger>
      <n-flex
        class="ai-mode-card"
        :class="{ selected: selected }"
        @click="handleClick"
      >
        <n-text class="label">{{ label }}</n-text>
        <n-text class="description">{{ description }}</n-text>
      </n-flex>
    </template>
    {{ tip }}
  </n-tooltip>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
  description: string;
  tip: string;
  value: string;
  selected?: boolean;
}>();

const emit = defineEmits(["click"] as const);

const handleClick = () => {
  emit("click");
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.ai-mode-card {
  flex-direction: column !important;
  padding: $spacing-sm;
  border-radius: $radius-md;
  border: 1px solid var(--border-color);
  gap: 0px !important;
  align-items: center;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }
  &.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
    background-color: var(--bg-primary);
  }
  .label {
    font-size: $font-sm;
    font-weight: $font-medium;
  }
  .description {
    font-size: $font-xs;
    color: var(--text-third) !important;
  }
}
</style>
