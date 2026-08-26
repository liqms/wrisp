<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Add } from "@vicons/ionicons5";
import type { PageTree } from "@/main/types/db";
import { PAGE_TYPE } from "@/shared/enums";
import { usePage } from "@/renderer/composables/usePage";
import FileTreeNode from "./FileTreeNode.vue";
import PageOperationModal from "./PageOperationModal.vue";

const props = withDefaults(
  defineProps<{
    projectId: string;
    nodes: PageTree[];
    selectedKey?: string | null;
  }>(),
  { selectedKey: null },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "changed"): void;
}>();

const { t } = useI18n();
const { createPage, deletePage, movePage } = usePage();

const operationVisible = ref(false);
const operationPage = ref<PageTree | null>(null);

async function createPageNode(parentId: string | null) {
  const id = await createPage({
    projectId: props.projectId,
    parentId,
    pageType: PAGE_TYPE.PROJECT_CHAPTER,
    title: t("TIPS.PAGE.NEW_CHAPTER"),
    content: "",
  });
  if (id) {
    emit("changed");
    // 新建页面后自动进入新页面编辑
    emit("select", id);
  }
}

function handleMore(node: PageTree) {
  operationPage.value = node;
  operationVisible.value = true;
}

async function handleMoved(pageId: string, parentId: string | null) {
  await movePage({ id: pageId, parentId });
  operationVisible.value = false;
  emit("changed");
}

async function handleDeleted(pageId: string) {
  await deletePage(pageId);
  operationVisible.value = false;
  emit("changed");
}
</script>

<template>
  <n-flex class="file-tree">
    <n-flex class="file-tree-header">
      <n-text class="file-tree-title">{{ t("APP.BASE.CATALOG") }}</n-text>
      <n-button quaternary circle size="tiny" :title="t('ACTION.COMMON.ADD')" @click="createPageNode(null)">
        <template #icon><n-icon>
            <Add />
          </n-icon></template>
      </n-button>
    </n-flex>
    <n-scrollbar class="file-tree-body">
      <div v-if="nodes.length === 0" class="file-tree-empty">
        {{ t("TIPS.PROJECT.OUTLINE.EMPTY") }}
      </div>
      <FileTreeNode v-for="node in nodes" :key="node.id" :node="node" :depth="0" :selected-key="selectedKey"
        @select="emit('select', $event)" @create="createPageNode" @more="handleMore" />
    </n-scrollbar>
    <PageOperationModal :show="operationVisible" :page="operationPage" :tree-nodes="nodes" :project-id="projectId"
      @update:show="operationVisible = $event" @moved="handleMoved" @deleted="handleDeleted" />
  </n-flex>
</template>

<style scoped lang="scss">
.file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.file-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between !important;
  flex-shrink: 0;
  width: 100%;
}

.file-tree-title {
  font-weight: 600;
  font-size: 13px;
}

.file-tree-body {
  flex: 1;
}

.file-tree-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-quaternary);
  font-size: 13px;
}
</style>
