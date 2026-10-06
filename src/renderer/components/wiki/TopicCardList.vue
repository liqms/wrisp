<template>
  <n-flex vertical :size="12" class="topic-card-list">
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
      <n-gi v-for="card in topicCards" :key="card.id">
        <n-card class="topic-card" size="small" hoverable>
          <template #header>
            <n-ellipsis :line-clamp="1">{{ card.title }}</n-ellipsis>
          </template>
          <template #header-extra>
            <n-flex :size="4" align="center">
              <n-button size="tiny" quaternary @click.stop="handleViewDetail(card.id)">
                {{ t("TIPS.WIKI.VIEW_DETAIL") }}
              </n-button>
              <n-button size="tiny" quaternary @click.stop="handleEdit(card)">
                {{ t("TIPS.WIKI.EDIT") }}
              </n-button>
              <n-button size="tiny" quaternary type="error" @click.stop="handleDelete(card)">
                {{ t("TIPS.WIKI.DELETE") }}
              </n-button>
            </n-flex>
          </template>
          <n-flex vertical :size="6">
            <n-ellipsis
              v-if="card.summary"
              :line-clamp="2"
              class="card-summary"
            >
              {{ card.summary }}
            </n-ellipsis>
            <n-flex align="center" :size="8" class="card-meta">
              <n-tag size="tiny" type="info">
                {{ t("TIPS.WIKI.BLOCK_COUNT") }}: {{ card.blockCount }}
              </n-tag>
              <n-tag size="tiny" type="success">
                {{ t("TIPS.WIKI.CONCEPT_COUNT") }}: {{ card.conceptCount }}
              </n-tag>
              <n-text depth="3" class="card-date">
                {{ card.updatedAt?.slice(0, 10) }}
              </n-text>
            </n-flex>
          </n-flex>
        </n-card>
      </n-gi>
    </n-grid>

    <n-empty v-if="!loading && topicCards.length === 0" :description="t('TIPS.WIKI.NO_TOPICS')" />

    <!-- 分页 -->
    <n-flex v-if="topicCardsTotal > pageSize" justify="center">
      <n-pagination
        v-model:page="currentPage"
        :page-count="Math.ceil(topicCardsTotal / pageSize)"
        @update:page="handlePageChange"
      />
    </n-flex>

    <!-- 详情抽屉 -->
    <n-drawer v-model:show="drawerVisible" :width="480" placement="right">
      <n-drawer-content>
        <template #header>
          <n-text style="font-weight:600">{{ currentTopic?.title ?? "" }}</n-text>
        </template>
        <n-spin v-if="detailLoading" />
        <n-flex v-else-if="currentTopic" vertical :size="12">
          <n-text v-if="currentTopic.summary" depth="2">
            {{ currentTopic.summary }}
          </n-text>
          <n-divider />
          <n-text depth="3" style="font-size: 13px">
            {{ t("TIPS.WIKI.BLOCK_COUNT") }}: {{ currentTopic.blocks?.length ?? 0 }}
            | {{ t("TIPS.WIKI.CONCEPT_COUNT") }}: {{ currentTopic.concepts?.length ?? 0 }}
          </n-text>
          <n-flex vertical :size="6">
            <n-text
              v-for="block in currentTopic.blocks"
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

    <!-- 编辑弹窗 -->
    <n-modal
      v-model:show="editModalVisible"
      preset="dialog"
      :title="t('TIPS.WIKI.EDIT_TOPIC_TITLE')"
      :positive-text="t('TIPS.WIKI.CONFIRM')"
      :negative-text="t('TIPS.WIKI.CANCEL')"
      @positive-click="handleEditConfirm"
    >
      <n-flex vertical :size="12">
        <n-form-item :label="t('TIPS.WIKI.TITLE_LABEL')">
          <n-input v-model:value="editForm.title" />
        </n-form-item>
        <n-form-item :label="t('TIPS.WIKI.SUMMARY_LABEL')">
          <n-input v-model:value="editForm.summary" type="textarea" :rows="4" />
        </n-form-item>
      </n-flex>
    </n-modal>

    <!-- 删除确认 -->
    <n-modal
      v-model:show="deleteModalVisible"
      preset="dialog"
      :title="t('TIPS.WIKI.DELETE_TOPIC_TITLE')"
      :content="t('TIPS.WIKI.DELETE_TOPIC_CONTENT')"
      :positive-text="t('TIPS.WIKI.CONFIRM')"
      :negative-text="t('TIPS.WIKI.CANCEL')"
      type="warning"
      @positive-click="handleDeleteConfirm"
    />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from "vue";
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
  NModal,
  NFormItem,
  NButton,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { useWiki } from "@/renderer/composables/useWiki";
import type { TopicCard } from "@/shared/types";

const { t } = useI18n();
const {
  topicCards,
  topicCardsTotal,
  loading,
  currentTopic,
  loadTopicCards,
  selectTopic,
  updateTopic,
  deleteTopic,
} = useWiki();

const keyword = ref("");
const sortBy = ref("updated_at");
const currentPage = ref(1);
const pageSize = 30;
const drawerVisible = ref(false);
const detailLoading = ref(false);

const editModalVisible = ref(false);
const editForm = reactive({ id: "", title: "", summary: "" });

const deleteModalVisible = ref(false);
const deleteTargetId = ref("");

const sortOptions = [
  { label: t("TIPS.WIKI.SORT_UPDATED"), value: "updated_at" },
  { label: t("TIPS.WIKI.SORT_TITLE"), value: "title" },
];

const fetchCards = () => {
  loadTopicCards({
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
  await selectTopic(id);
  detailLoading.value = false;
};

const handleEdit = (card: TopicCard) => {
  editForm.id = card.id;
  editForm.title = card.title;
  editForm.summary = card.summary ?? "";
  editModalVisible.value = true;
};

const handleEditConfirm = async () => {
  const ok = await updateTopic(editForm.id, {
    title: editForm.title,
    summary: editForm.summary,
  });
  if (ok) {
    fetchCards();
  }
};

const handleDelete = (card: TopicCard) => {
  deleteTargetId.value = card.id;
  deleteModalVisible.value = true;
};

const handleDeleteConfirm = async () => {
  const ok = await deleteTopic(deleteTargetId.value);
  if (ok) {
    fetchCards();
  }
};

onMounted(() => {
  fetchCards();
});
</script>

<style scoped lang="scss">
.topic-card-list {
  padding: 4px 0;
}

.topic-card {
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
