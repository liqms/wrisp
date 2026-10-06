<template>
  <n-flex vertical :size="16" class="wiki-overview">
    <!-- 统计卡片 -->
    <n-grid :cols="5" :x-gap="12" responsive="screen">
      <n-gi>
        <n-card class="stat-card" size="small">
          <n-statistic :label="t('TIPS.WIKI.STAT_JOURNALS')" :value="stats?.journalCount ?? 0" />
        </n-card>
      </n-gi>
      <n-gi>
        <n-card class="stat-card" size="small">
          <n-statistic :label="t('TIPS.WIKI.STAT_CHUNKS')" :value="stats?.chunkCount ?? 0" />
        </n-card>
      </n-gi>
      <n-gi>
        <n-card class="stat-card" size="small">
          <n-statistic :label="t('TIPS.WIKI.STAT_CONCEPTS')" :value="stats?.conceptCount ?? 0" />
        </n-card>
      </n-gi>
      <n-gi>
        <n-card class="stat-card" size="small">
          <n-statistic :label="t('TIPS.WIKI.STAT_TOPICS')" :value="stats?.topicCount ?? 0" />
        </n-card>
      </n-gi>
      <n-gi>
        <n-card class="stat-card" size="small">
          <n-statistic :label="t('TIPS.WIKI.STAT_PROJECTS')" :value="stats?.projectCount ?? 0" /> 
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 近期概念 + 近期主题 -->
    <n-grid :cols="2" :x-gap="16" responsive="screen" :cols-1="[700]" class="top-section">
      <n-gi>
        <n-card size="small" class="top-card">
          <template #header>
            <n-text depth="1" style="font-weight:600">{{ t("TIPS.WIKI.RECENT_CONCEPTS") }}</n-text>
          </template>
          <n-scrollbar style="max-height: 360px">
            <n-flex vertical :size="6">
              <n-flex v-for="item in recentConcepts" :key="item.id" align="center" justify="space-between"
                class="top-item" @click="selectConcept(item.id)">
                <n-ellipsis style="flex:1">{{ item.title }}</n-ellipsis>
                <n-tag size="tiny" type="info">{{ item.blockCount }}</n-tag>
              </n-flex>
              <n-empty v-if="recentConcepts.length === 0" :description="t('TIPS.WIKI.NO_CONCEPTS')" size="small" />
            </n-flex>
          </n-scrollbar>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card size="small" class="top-card">
          <template #header>
            <n-text depth="1" style="font-weight:600">{{ t("TIPS.WIKI.RECENT_TOPICS") }}</n-text>
          </template>
          <n-scrollbar style="max-height: 360px">
            <n-flex vertical :size="6">
              <n-flex v-for="item in recentTopics" :key="item.id" align="center" justify="space-between"
                class="top-item" @click="selectTopic(item.id)">
                <n-ellipsis style="flex:1">{{ item.title }}</n-ellipsis>
                <n-flex :size="4" align="center">
                  <n-tag size="tiny" type="info">{{ item.blockCount }}</n-tag>
                  <n-tag size="tiny" type="success">{{ item.conceptCount }}</n-tag>
                </n-flex>
              </n-flex>
              <n-empty v-if="recentTopics.length === 0" :description="t('TIPS.WIKI.NO_TOPICS')" size="small" />
            </n-flex>
          </n-scrollbar>
        </n-card>
      </n-gi>
    </n-grid>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  NFlex,
  NText,
  NGrid,
  NGi,
  NCard,
  NStatistic,
  NScrollbar,
  NEllipsis,
  NTag,
  NEmpty,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useWiki } from "@/renderer/composables/useWiki";

const { t } = useI18n();
const { overview, selectConcept, selectTopic } = useWiki();

const stats = computed(() => overview.value?.stats);
const recentConcepts = computed(() => overview.value?.recentConcepts ?? []);
const recentTopics = computed(() => overview.value?.recentTopics ?? []);
</script>

<style scoped lang="scss">
.wiki-overview {
  padding: 4px 0;
}

.stat-card {
  text-align: center;
}

.top-card {
  height: 420px;
}

.top-item {
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f5f5;
  }
}
</style>
