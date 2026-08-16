<template>
  <n-flex class="wiki-view" vertical>
    <n-spin v-if="loading" class="loading" />
    <n-flex v-else class="wiki-content" gap="12">
      <!-- 左侧：概念列表 -->
      <n-flex class="wiki-panel wiki-panel-left" vertical>
        <n-text class="wiki-panel-title" depth="1">
          {{ t("APP.BASE.CONCEPTS") }}
        </n-text>
        <n-divider class="panel-divider" />
        <n-scrollbar class="wiki-list">
          <n-flex v-for="concept in concepts" :key="concept.id" class="wiki-item"
            :class="{ active: currentConcept?.id === concept.id }" @click="selectConcept(concept.id)">
            <n-ellipsis class="wiki-item-text">
              {{ concept.title }}
            </n-ellipsis>
          </n-flex>
          <n-empty v-if="concepts.length === 0" description="暂无概念" />
        </n-scrollbar>
      </n-flex>

      <!-- 中间：主题详情 -->
      <n-flex class="wiki-panel wiki-panel-middle" vertical>
        <n-text class="wiki-panel-title" depth="1">
          {{ t("APP.BASE.TOPICS") }}
        </n-text>
        <n-divider class="panel-divider" />
        <n-scrollbar class="wiki-list">
          <n-flex v-for="topic in topics" :key="topic.id" class="wiki-item"
            :class="{ active: currentTopic?.id === topic.id }" @click="selectTopic(topic.id)">
            <n-ellipsis class="wiki-item-text">
              {{ topic.title }}
            </n-ellipsis>
          </n-flex>
          <n-empty v-if="topics.length === 0" description="暂无主题" />
        </n-scrollbar>
      </n-flex>

      <!-- 右侧：反思时间线 -->
      <n-flex class="wiki-panel wiki-panel-right" vertical>
        <n-text class="wiki-panel-title" depth="1">
          {{ t("APP.BASE.REFLECTIONS") }}
        </n-text>
        <n-divider class="panel-divider" />
        <n-scrollbar class="wiki-list">
          <n-flex v-for="reflection in reflections" :key="reflection.id" class="wiki-item wiki-item-reflection">
            <n-flex vertical class="wiki-item-reflection-content">
              <n-text class="reflection-type" depth="3">
                {{ reflection.type }}
              </n-text>
              <n-ellipsis class="wiki-item-text" :line-clamp="2">
                {{ reflection.title }}
              </n-ellipsis>
              <n-text class="reflection-date" depth="3">
                {{ reflection.created_at?.slice(0, 10) }}
              </n-text>
            </n-flex>
          </n-flex>
          <n-empty v-if="reflections.length === 0" description="暂无反思" />
        </n-scrollbar>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import {
  NFlex,
  NText,
  NSpin,
  NEmpty,
  NScrollbar,
  NDivider,
  NEllipsis,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useWiki } from "@/renderer/composables/useWiki";

const { t } = useI18n();
const {
  concepts,
  topics,
  reflections,
  currentConcept,
  currentTopic,
  loading,
  loadConcepts,
  loadTopics,
  loadReflections,
  selectConcept,
  selectTopic,
} = useWiki();

onMounted(async () => {
  await Promise.all([loadConcepts(), loadTopics(), loadReflections()]);
});
</script>

<style scoped lang="scss">
.wiki-view {
  height: 100%;
  padding: 16px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.wiki-content {
  height: 100%;
  flex: 1;
}

.wiki-panel {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  overflow: hidden;
}

.wiki-panel-title {
  font-size: 15px;
  font-weight: 600;
}

.panel-divider {
  margin: 4px 0;
}

.wiki-list {
  flex: 1;
  overflow-y: auto;
}

.wiki-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;

  &:hover {
    background-color: #f5f5f5;
  }

  &.active {
    background-color: #e8f4fd;
  }
}

.wiki-item-text {
  width: 100%;
  font-size: 14px;
}

.wiki-item-reflection {
  cursor: default;
}

.wiki-item-reflection-content {
  width: 100%;
  gap: 2px;
}

.reflection-type {
  font-size: 11px;
  text-transform: uppercase;
}

.reflection-date {
  font-size: 12px;
}
</style>