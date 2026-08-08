<template>
  <n-card :title="title" size="small">
    <n-flex v-if="projects.length === 0" justify="center" class="empty-state">
      <n-text depth="3">{{ t('PROJECT.LIST.EMPTY') }}</n-text>
    </n-flex>
    <n-list v-else>
      <n-list-item v-for="project in projects" :key="project.id">
        <n-thing :title="project.name" :description="project.description">
          <template #footer>
            <n-text depth="3" class="project-meta">
              {{ t('PROJECT.LIST.UPDATED_AT', { time: project.updatedAt }) }}
            </n-text>
          </template>
        </n-thing>
      </n-list-item>
    </n-list>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NFlex, NText, NList, NListItem, NThing } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
}

const props = withDefaults(
  defineProps<{
    title?: string;
    projects?: ProjectItem[];
  }>(),
  {
    title: "",
    projects: () => [],
  },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
}>();
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.empty-state {
  padding: $spacing-lg 0;
}

.project-meta {
  font-size: $font-xs;
}
</style>