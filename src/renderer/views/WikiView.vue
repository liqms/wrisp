<template>
  <n-flex class="wiki-view" vertical>
    <!-- 全局栏：待整理资源数 + 智能整理按钮 -->
    <n-flex class="wiki-header" align="center" justify="space-between">
      <n-flex align="center" :size="8">
        <n-tag v-if="pendingCount > 0" type="warning" size="small" round>
          {{ t("TIPS.WIKI.PENDING_RESOURCES") }}: {{ pendingCount }}
        </n-tag>
      </n-flex>
      <n-flex align="center" :size="8">
        <n-button v-if="!organizing" type="primary" size="small" :loading="organizing" @click="handleOrganize">
          <template #icon><n-icon>
              <AutoMergeIcon />
            </n-icon></template>
          {{ t("TIPS.WIKI.SMART_ORGANIZE") }}
        </n-button>
        <n-flex v-else align="center" :size="8">
          <n-spin size="small" />
          <n-text depth="3">{{ t("TIPS.WIKI.ORGANIZING") }}</n-text>
          <n-button size="small" @click="handleCancelOrganize">
            {{ t("TIPS.WIKI.ORGANIZE_CANCEL") }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- Tab 导航 -->
    <n-tabs v-model:value="activeTab" type="line" animated class="wiki-tabs">
      <n-tab-pane name="overview" :tab="t('TIPS.WIKI.TAB_OVERVIEW')">
        <WikiOverview />
      </n-tab-pane>
      <n-tab-pane name="concepts" :tab="t('TIPS.WIKI.TAB_CONCEPTS')">
        <ConceptCardList />
      </n-tab-pane>
      <n-tab-pane name="topics" :tab="t('TIPS.WIKI.TAB_TOPICS')">
        <TopicCardList />
      </n-tab-pane>
    </n-tabs>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, h } from "vue";
import {
  NFlex,
  NText,
  NTabs,
  NTabPane,
  NTag,
  NButton,
  NIcon,
  NSpin,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useWiki } from "@/renderer/composables/useWiki";
import WikiOverview from "@/renderer/components/wiki/WikiOverview.vue";
import ConceptCardList from "@/renderer/components/wiki/ConceptCardList.vue";
import TopicCardList from "@/renderer/components/wiki/TopicCardList.vue";

const AutoMergeIcon = () => h("span", { style: "font-size:14px" }, "⚡");

const { t } = useI18n();
const {
  pendingCount,
  organizing,
  loadOverview,
  loadPendingCount,
  loadConceptCards,
  loadTopicCards,
  startOrganize,
  cancelOrganize,
} = useWiki();

const activeTab = ref("overview");

const handleOrganize = async () => {
  await startOrganize();
};

const handleCancelOrganize = async () => {
  await cancelOrganize();
};

const loadWikiData = async () => {
  await Promise.all([
    loadOverview(),
    loadPendingCount(),
    loadConceptCards(),
    loadTopicCards(),
  ]);
};

let disposeWikiUpdated: (() => void) | null = null;

onMounted(async () => {
  // 主进程切分 / 智能整理完成后广播 wiki:updated，自动刷新视图数据
  disposeWikiUpdated = window.electronAPI.wiki.onUpdated(() => {
    void loadWikiData();
  });
  await loadWikiData();
});

onUnmounted(() => {
  disposeWikiUpdated?.();
  disposeWikiUpdated = null;
});
</script>

<style scoped lang="scss">
.wiki-view {
  height: 100%;
  padding: 16px;
}

.wiki-header {
  padding: 4px 0 8px;
}

.wiki-tabs {
  flex: 1;
  overflow: hidden;
}

:deep(.n-tab-pane) {
  height: 100%;
  overflow-y: auto;
}
</style>
