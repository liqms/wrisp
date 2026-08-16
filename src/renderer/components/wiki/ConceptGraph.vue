<template>
  <n-card :title="title" size="small">
    <n-flex v-if="concepts.length === 0" justify="center" class="empty-state">
      <n-text depth="3">{{ t('WIKI.CONCEPT_GRAPH.EMPTY') }}</n-text>
    </n-flex>
    <n-flex v-else wrap class="concept-grid">
      <n-tag
        v-for="concept in concepts"
        :key="concept.id"
        :type="concept.color as any || 'default'"
        :bordered="false"
        size="large"
        class="concept-tag"
      >
        {{ concept.label }}
      </n-tag>
    </n-flex>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NFlex, NText, NTag } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

export interface Concept {
  id: string;
  label: string;
  color?: string;
}

withDefaults(
  defineProps<{
    title?: string;
    concepts?: Concept[];
  }>(),
  {
    title: "",
    concepts: () => [],
  },
);
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.empty-state {
  padding: $spacing-lg 0;
}

.concept-grid {
  gap: $spacing-xs;
}

.concept-tag {
  cursor: pointer;
  transition: transform 0.15s ease;

  &:hover {
    transform: scale(1.05);
  }
}
</style>