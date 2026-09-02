<template>
  <n-flex vertical class="project-view">
    <!-- 顶部：搜索框 + 新建按钮 -->
    <n-flex class="toolbar" justify="space-between" align="center">
      <n-input v-model:value="searchKeyword" :placeholder="t('TIPS.SEARCH.SEARCH_PROJECT')" clearable :loading="loading"
        class="search-input">
        <template #prefix>
          <n-icon>
            <Search />
          </n-icon>
        </template>
      </n-input>
      <n-button type="primary" @click="openCreateModal">
        <template #icon>
          <n-icon>
            <Add />
          </n-icon>
        </template>
        {{ t('ACTION.NEW.PROJECT') }}
      </n-button>
    </n-flex>

    <!-- 作品列表区域 -->
    <div ref="scrollContainerRef" class="project-scroll" @scroll="handleScroll">
      <n-spin :show="loading && allProjects.length === 0">
        <!-- 空状态 -->
        <n-empty v-if="allProjects.length === 0 && !loading" class="empty-state"
          :description="t('TIPS.PROJECT.NO_PROJECT')" />

        <template v-else>
          <!-- 置顶作品模块 -->
          <ProjectCardList :title="t('ACTION.COMMON.TOP')" :projects="pinnedProjects" @click="openWorkspace"
            @settings="openEditModal" @pin="handleTogglePin" />

          <!-- 普通作品模块 -->
          <ProjectCardList :title="pinnedProjects.length > 0 ? t('ACTION.ALL.ALL_PROJECT') : undefined"
            :projects="regularProjects" @click="openWorkspace" @settings="openEditModal" @pin="handleTogglePin" />

          <!-- 加载更多指示器 -->
          <n-flex v-if="loading && allProjects.length > 0" class="loading-more">
            <n-spin size="small" />
          </n-flex>
        </template>
      </n-spin>
    </div>

    <!-- 新建/编辑对话框 -->
    <ProjectEditModal :show="showModal" :project="editingProject" @update:show="showModal = $event"
      @saved="handleSearch" />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import { Search, Add } from "@vicons/ionicons5";
import { useProject } from "@/renderer/composables/useProject";
import ProjectCardList from "@/renderer/components/project/ProjectCardList.vue";
import ProjectEditModal from "@/renderer/components/project/ProjectEditModal.vue";
import type { ProjectDetail } from "@/main/types/db";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

const message = useMessage();
const router = useRouter();

const {
  projects,
  loading,
  pagination,
  paginateProjects,
  getProjectDetail,
  setPinned,
} = useProject();

// 累积的作品列表（用于无限滚动）
const allProjects = ref<ProjectDetail[]>([]);

// 搜索
const searchKeyword = ref("");

// 分页状态
const currentPage = ref(1);
const pageSize = ref(24);
const hasMore = ref(true);

// 滚动容器引用
const scrollContainerRef = ref<HTMLElement | null>(null);

// 置顶作品列表
const pinnedProjects = computed(() =>
  allProjects.value.filter((p) => !!p.is_pinned)
);

// 普通作品列表
const regularProjects = computed(() =>
  allProjects.value.filter((p) => !p.is_pinned)
);

// 加载数据
const loadProjects = async (page: number, append: boolean) => {
  if (loading.value) return;
  if (append && !hasMore.value) return;

  await paginateProjects({
    page,
    pageSize: pageSize.value,
    orderBy: "updated_at",
    orderDir: "DESC",
    conditions: searchKeyword.value ? { name: `%${searchKeyword.value}%` } : undefined,
  });

  if (append) {
    allProjects.value = [...allProjects.value, ...projects.value];
  } else {
    allProjects.value = [...projects.value];
  }

  hasMore.value = pagination.value?.hasNext ?? false;
  currentPage.value = page;
};

// 搜索（重置后加载第一页）
const handleSearch = async () => {
  currentPage.value = 1;
  hasMore.value = true;
  await loadProjects(1, false);
  // 搜索后滚动到顶部
  scrollContainerRef.value?.scrollTo({ top: 0 });
};

// 输入即搜索（300ms 防抖）
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchKeyword, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    handleSearch();
  }, 300);
});

// 滚动事件处理
const handleScroll = () => {
  const container = scrollContainerRef.value;
  if (!container) return;

  const { scrollTop, scrollHeight, clientHeight } = container;
  const threshold = 100; // 距离底部 100px 时触发

  if (scrollHeight - scrollTop - clientHeight < threshold) {
    loadMore();
  }
};

// 加载下一页
const loadMore = async () => {
  if (loading.value || !hasMore.value) return;
  await loadProjects(currentPage.value + 1, true);
};

// 切换置顶状态
const handleTogglePin = async (id: string) => {
  const project = allProjects.value.find((p) => p.id === id);
  if (!project) return;

  const isPinned = !project.is_pinned;
  const success = await setPinned(id, isPinned);
  if (success) {
    // 同步本地累积列表，驱动置顶/普通分区重新划分
    allProjects.value = allProjects.value.map((p) =>
      p.id === id ? { ...p, is_pinned: isPinned } : p
    );
    message.success(isPinned ? t('ACTION.COMMON.TOP') : t('ACTION.COMMON.UNTOP'));
  } else {
    message.error(t('NOTIFICATION.ERROR'));
  }
};

// 新建/编辑对话框
const showModal = ref(false);
const editingProject = ref<ProjectDetail | null>(null);

const openCreateModal = () => {
  editingProject.value = null;
  showModal.value = true;
};

const openEditModal = async (id: string) => {
  const projectDetail = await getProjectDetail(id) as ProjectDetail;
  if (!projectDetail) {
    message.error(t('ERROR.CREATION.NOT_FOUND'));
    return;
  }
  editingProject.value = projectDetail;
  showModal.value = true;
};

// 进入作品创作空间
const openWorkspace = (id: string) => {
  router.push(`/projects/${id}`);
};

// 初始化加载
onMounted(() => {
  handleSearch();
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.project-view {
  padding: $spacing-xl;
  height: 100%;
  gap: $spacing-md;

  .toolbar {
    flex-shrink: 0;

    .search-input {
      width: 320px;
    }
  }

  .project-scroll {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: $spacing-md 0;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    padding: 80px 0;
  }

  .loading-more {
    display: flex;
    justify-content: center;
    padding: $spacing-md 0;
  }
}
</style>
