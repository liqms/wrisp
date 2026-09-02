<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Add,
  EllipsisHorizontal,
  ChevronForward,
  ChevronDown,
} from "@vicons/ionicons5";
import type { PageTree } from "@/main/types/db";

const props = defineProps<{
  node: PageTree;
  depth: number;
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "create", parentId: string): void;
  (e: "more", node: PageTree): void;
}>();

const { t } = useI18n();
const expanded = ref(false);

// 子页面数量增加时（新建/移入子页）自动展开，便于看到新页面
watch(
  () => props.node.children?.length,
  (newLen, oldLen) => {
    if ((newLen ?? 0) > (oldLen ?? 0)) {
      expanded.value = true;
    }
  },
);
</script>

<template>
  <n-flex vertical>
    <n-flex :wrap="false" :gap="4" align="center" class="file-node" :class="{
      selected: node.id === selectedKey,
      'has-children': !!node.children?.length,
    }" :style="{ paddingLeft: depth * 16 + 8 + 'px' }" @click.stop="emit('select', node.id)">
      <n-space v-if="node.children?.length" class="file-node-caret" align="center" @click.stop="expanded = !expanded">
        <n-icon size="12">
          <ChevronForward v-if="!expanded" />
          <ChevronDown v-else />
        </n-icon>
      </n-space>
      <span v-else class="file-node-caret file-node-caret--empty" />
      <n-ellipsis class="file-node-title" :tooltip="false" :title="node.title">
        {{ node.title }}
      </n-ellipsis>
      <n-flex :wrap="false" :gap="2" align="center" class="file-node-actions">
        <n-button quaternary circle size="tiny" class="file-node-action" :title="t('ACTION.COMMON.ADD')"
          @click.stop="emit('create', node.id)">
          <template #icon>
            <n-icon size="14">
              <Add />
            </n-icon>
          </template>
        </n-button>
        <n-button quaternary circle size="tiny" class="file-node-action" :title="t('APP.BASE.MORE')"
          @click.stop="emit('more', node)">
          <template #icon>
            <n-icon size="14">
              <EllipsisHorizontal />
            </n-icon>
          </template>
        </n-button>
      </n-flex>
    </n-flex>
    <template v-if="expanded && node.children?.length">
      <FileTreeNode v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1"
        :selected-key="selectedKey" @select="emit('select', $event)" @create="emit('create', $event)"
        @more="emit('more', $event)" />
    </template>
  </n-flex>
</template>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.file-node {
  height: 30px;
  padding-right: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  align-items: center;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &.selected {
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    color: var(--primary-color);
  }
}

.file-node-caret {
  display: inline-flex;
  flex-shrink: 0;
  width: 16px;
}

.file-node-caret--empty {
  width: 16px;
}

.file-node-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 30px;
}

.file-node-actions {
  flex-shrink: 0;
  justify-content: center;
  gap: $spacing-xs !important;
}

.file-node-action {
  align-items: center;
  justify-content: center;
}

.file-node:not(:hover) .file-node-actions {
  display: none !important;
}
</style>
