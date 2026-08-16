<template>
  <n-card :title="title" size="small">
    <n-flex v-if="topics.length === 0" justify="center" class="empty-state">
      <n-text depth="3">{{ t('WIKI.TOPIC_LIST.EMPTY') }}</n-text>
    </n-flex>
    <n-list v-else>
      <n-list-item v-for="topic in topics" :key="topic.id">
        <n-thing :title="topic.label" :description="topic.summary">
          <template #avatar>
            <n-avatar :size="28" round>
              {{ topic.label.charAt(0) }}
            </n-avatar>
          </template>
          <template #footer>
            <n-text depth="3" class="topic-count">
              {{ t('WIKI.TOPIC_LIST.ITEM_COUNT', { count: topic.count }) }}
            </n-text>
          </template>
        </n-thing>
      </n-list-item>
    </n-list>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NFlex, NText, NList, NListItem, NThing, NAvatar } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

export interface Topic {
  id: string;
  label: string;
  summary: string;
  count: number;
}

withDefaults(
  defineProps<{
    title?: string;
    topics?: Topic[];
  }>(),
  {
    title: "",
    topics: () => [],
  },
);
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.empty-state {
  padding: $spacing-lg 0;
}

.topic-count {
  font-size: $font-xs;
}
</style>