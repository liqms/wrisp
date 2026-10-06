<template>
  <n-flex vertical :size="12" class="concept-card-list">
    <!-- 搜索 + 排序 -->
    <n-flex align="center" :size="12">
      <n-input
        v-model:value="keyword"
        :placeholder="t('TIPS.WIKI.SEARCH_PLACEHOLDER')"
        clearable
        size="small"
        style="width: 240px"
        @update:value="handleSearch"
      />
      <n-select
        v-model:value="sortBy"
        :options="sortOptions"
        size="small"
        style="width: 140px"
        @update:value="handleSort"
      />
    </n-flex>

    <!-- 卡片网格 -->
    <n-spin v-if="loading" />
    <n-grid v-else :cols="3" :x-gap="12" :y-gap="12" responsive="screen">
      <n-gi v-for="card in conceptCards" :key="card.id">
        <n-card class="concept-card" size="small" hoverable @click="handleViewDetail(card.id)">
          <template #header>
            <n-ellipsis :line-clamp="1">{{ card.title }}</n-ellipsis>
          </template>
          <n-flex vertical :size="6">
            <n-ellipsis
              v-if="card.evolvingSummary"
              :line-clamp="2"
              class="card-summary"
            >
              {{ card.evolvingSummary }}
            </n-ellipsis>
            <n-flex align="center" :size="8" class="card-meta">
              <n-tag size="tiny" type="info">
                {{ t("TIPS.WIKI.BLOCK_COUNT") }}: {{ card.blockCount }}
              </n-tag>
              <n-text depth="3" class="card-date">
                {{ card.updatedAt?.slice(0, 10) }}
              </n-text>
            </n-flex>
          </n-flex>
        </n-card>
      </n-gi>
    </n-grid>

    <n-empty v-if="!loading && conceptCards.length === 0" :description="t('TIPS.WIKI.NO_CONCEPTS')" />

    <!-- 分页 -->
    <n-flex v-if="conceptCardsTotal > pageSize" justify="center">
      <n-pagination
        v-model:page="currentPage"
        :page-count="Math.ceil(conceptCardsTotal / pageSize)"
        @update:page="handlePageChange"
      />
    </n-flex>

    <!-- 详情抽屉 -->
    <n-drawer v-model:show="drawerVisible" :width="480" placement="right">
      <n-drawer-content>
        <template #header>
          <n-text style="font-weight:600">{{ currentConcept?.title ?? "" }}</n-text>
        </template>
        <n-spin v-if="detailLoading" />
        <n-flex v-else-if="currentConcept" vertical :size="12">
          <n-text v-if="currentConcept.evolving_summary" depth="2">
            {{ currentConcept.evolving_summary }}
          </n-text>
          <n-divider />
          <n-text depth="3" style="font-size: 13px">
            {{ t("TIPS.WIKI.BLOCK_COUNT") }}: {{ currentConcept.blocks?.length ?? 0 }}
          </n-text>
          <n-flex vertical :size="6">
            <n-text
              v-for="block in currentConcept.blocks"
              :key="block.id"
              depth="2"
              class="block-item"
            >
              {{ block.content?.slice(0, 120) }}
            </n-text>
          </n-flex>
        </n-flex>
      </n-drawer-content>
    </n-drawer>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  NFlex,
  NText,
  NInput,
  NSelect,
  NGrid,
  NGi,
  NCard,
  NTag,
  NEllipsis,
  NEmpty,
  NSpin,
  NPagination,
  NDrawer,
  NDrawerContent,
  NDivider,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useWiki } from "@/renderer/composables/useWiki";

const { t } = useI18n();
const {
  conceptCards,
  conceptCardsTotal,
  loading,
  currentConcept,
  loadConceptCards,
  selectConcept,
} = useWiki();

const keyword = ref("");
const sortBy = ref("relevance");
const currentPage = ref(1);
const pageSize = 30;
const drawerVisible = ref(false);
const detailLoading = ref(false);

const sortOptions = [
  { label: t("TIPS.WIKI.SORT_RELEVANCE"), value: "relevance" },
  { label: t("TIPS.WIKI.SORT_UPDATED"), value: "updated_at" },
  { label: t("TIPS.WIKI.SORT_TITLE"), value: "title" },
];

const fetchCards = () => {
  loadConceptCards({
    keyword: keyword.value || undefined,
    orderBy: sortBy.value,
    orderDir: sortBy.value === "title" ? "ASC" : "DESC",
    page: currentPage.value,
    pageSize,
  });
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchCards();
};

const handleSort = () => {
  currentPage.value = 1;
  fetchCards();
};

const handlePageChange = () => {
  fetchCards();
};

const handleViewDetail = async (id: string) => {
  drawerVisible.value = true;
  detailLoading.value = true;
  await selectConcept(id);
  detailLoading.value = false;
};

onMounted(() => {
  fetchCards();
});
</script>

<style scoped lang="scss">
.concept-card-list {
  padding: 4px 0;
}

.concept-card {
  cursor: pointer;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
}

.card-summary {
  font-size: 13px;
  color: #666;
}

.card-meta {
  margin-top: 4px;
}

.card-date {
  font-size: 12px;
}

.block-item {
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 4px;
  background: #f9f9f9;
}
</style>
