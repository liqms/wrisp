<template>
  <n-card :title="title" size="small" class="outline-tree">
    <n-flex v-if="nodes.length === 0" justify="center" class="empty-state">
      <n-text depth="3">{{ t('PROJECT.OUTLINE.EMPTY') }}</n-text>
    </n-flex>
    <n-tree
      v-else
      :data="nodes"
      :block-line="true"
      :default-expand-all="true"
      @update:selected-keys="handleSelect"
    />
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NFlex, NText, NTree } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { TreeOption } from "naive-ui";

const { t } = useI18n();

withDefaults(
  defineProps<{
    title?: string;
    nodes?: TreeOption[];
  }>(),
  {
    title: "",
    nodes: () => [],
  },
);

const emit = defineEmits<{
  (e: "select", key: string): void;
}>();

function handleSelect(keys: Array<string | number>): void {
  if (keys.length > 0) {
    emit("select", String(keys[0]));
  }
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.outline-tree {
  :deep(.n-tree-node-content) {
    font-size: $font-sm;
  }
}

.empty-state {
  padding: $spacing-lg 0;
}
</style>