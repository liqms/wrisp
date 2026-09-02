<template>
    <n-layout has-sider class="page-view">
        <!-- 左侧边栏：作品信息 + 文件树 -->
        <n-layout-sider v-model:collapsed="siderCollapsed" bordered :width="240" collapsible :collapsed-width="20"
            show-trigger class="page-sider">
            <n-flex v-show="!siderCollapsed" vertical class="page-sider-inner">
                <!-- 作品信息 -->
                <n-flex vertical class="project-info">
                    <n-ellipsis class="project-name" :tooltip="false">
                        {{ project?.name }}
                    </n-ellipsis>
                    <n-flex class="project-tags">
                        <n-tag v-if="project" size="small" :bordered="false" class="project-type-tag">
                            {{ projectTypeLabel }}
                        </n-tag>
                        <n-tag v-if="project" size="small" :bordered="false" class="project-count-tag">
                            {{ project?.page_count ?? 0 }} {{ t('TIPS.COMMON.CHAPTER') }}
                        </n-tag>
                    </n-flex>
                </n-flex>

                <n-divider style="margin: 4px 0;" />

                <!-- 文件树 -->
                <n-flex vertical class="file-tree-wrap">
                    <FileTree :project-id="projectId" :nodes="pageTree ?? []" :selected-key="currentPageId"
                        @select="handleSelect" @changed="handleTreeChanged" />
                </n-flex>
            </n-flex>
        </n-layout-sider>

        <!-- 右侧：页面编辑区（悬浮目录浮层绝对定位覆盖其上） -->
        <div class="page-content">
            <div class="editor-wrap">
                <n-spin v-if="loading" class="content-state" />
                <PageBlock v-else-if="currentPageId" ref="pageBlockRef" :key="currentPageId" :pageID="currentPageId"
                    @saved="handleSaved" @catalog="handleCatalog" @catalog-active="handleCatalogActive" />
                <n-empty v-else class="content-state" :description="t('TIPS.PAGE.NO_PAGE_SELECTED')" />
            </div>
            <CatalogTree :items="catalogItems" :active-index="activeCatalogIndex" @select="handleCatalogSelect" />
        </div>
    </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { PAGE_TYPE } from "@/shared/enums";
import type { ProjectDetail } from "@/main/types/db";
import type { PageCatalogItem } from "@/shared/types/page.types";
import { useProject } from "@/renderer/composables/useProject";
import { usePage } from "@/renderer/composables/usePage";
import FileTree from "@/renderer/components/project/FileTree.vue";
import CatalogTree from "@/renderer/components/project/CatalogTree.vue";
import PageBlock from "@/renderer/components/editor/containers/PageBlock.vue";

const { t } = useI18n();
const route = useRoute();

/** 左侧边栏收起状态 */
const siderCollapsed = ref(false);

/** 当前作品 ID（来自路由参数） */
const projectId = computed(() => String(route.params.projectId ?? ""));

const { getProjectDetail } = useProject();
const { getPageTree, pageTree, createPage } = usePage();

/** 作品信息 */
const project = ref<ProjectDetail | null>(null);
/** 当前选中的页面 ID */
const currentPageId = ref<string | null>(null);
/** 首次加载状态 */
const loading = ref(false);
/** 当前页面目录（1-3 级标题） */
const catalogItems = ref<PageCatalogItem[]>([]);
/** 当前定位章节在目录中的索引（横线/浮层高亮） */
const activeCatalogIndex = ref(-1);
/** 编辑区实例，用于目录点击定位 */
const pageBlockRef = ref<InstanceType<typeof PageBlock> | null>(null);

/** 作品类型文案 */
const projectTypeLabel = computed(() =>
    project.value ? t(`APP.PROJECT_TYPE.${project.value.type.toUpperCase()}`) : "",
);

/** 作品还没有任何页面时，自动创建第一个章节并进入编辑 */
const autoCreateFirstPage = async (id: string) => {
    const newId = await createPage({
        projectId: id,
        parentId: null,
        pageType: PAGE_TYPE.PROJECT_CHAPTER,
        title: t("TIPS.PAGE.NEW_CHAPTER"),
        content: "",
    });
    if (!newId) return;
    // 刷新文件树与作品信息（更新章节数），并选中新页面
    await getPageTree(id, PAGE_TYPE.PROJECT_CHAPTER);
    void getProjectDetail(id).then((detail) => {
        if (detail) project.value = detail;
    });
    currentPageId.value = newId;
};

/** 加载作品信息与文件树，并默认选中第一个章节 */
const loadWorkspace = async (id: string) => {
    if (!id) return;
    loading.value = true;
    currentPageId.value = null;
    project.value = null;
    try {
        const [detail, tree] = await Promise.all([
            getProjectDetail(id),
            getPageTree(id, PAGE_TYPE.PROJECT_CHAPTER),
        ]);
        project.value = detail;
        if (!currentPageId.value) {
            const first = tree?.[0];
            if (first) {
                currentPageId.value = first.id;
            } else {
                // 作品没有任何页面：自动创建一个并进入
                await autoCreateFirstPage(id);
            }
        }
    } finally {
        loading.value = false;
    }
};

watch(projectId, (id) => loadWorkspace(id), { immediate: true });

/** 选中文件树节点 */
const handleSelect = (id: string) => {
    currentPageId.value = id;
};

/** 树增/删/移后刷新，同时刷新作品信息以更新 page_count */
const handleTreeChanged = () => {
    void getPageTree(projectId.value, PAGE_TYPE.PROJECT_CHAPTER);
    void getProjectDetail(projectId.value).then((detail) => {
        if (detail) project.value = detail;
    });
};

/** 页面保存后刷新文件树，保持章节标题同步 */
const handleSaved = () => {
    void getPageTree(projectId.value, PAGE_TYPE.PROJECT_CHAPTER);
};

/** 目录更新（来自编辑器） */
const handleCatalog = (items: PageCatalogItem[]) => {
    catalogItems.value = items;
};

/** 当前定位章节变化（来自编辑器滚动/编辑） */
const handleCatalogActive = (index: number) => {
    activeCatalogIndex.value = index;
};

/** 点击目录定位到对应标题 */
const handleCatalogSelect = (item: PageCatalogItem) => {
    pageBlockRef.value?.scrollToCatalog(item.pos);
};

/** 切换页面时清空旧目录与高亮 */
watch(currentPageId, () => {
    catalogItems.value = [];
    activeCatalogIndex.value = -1;
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.page-view {
    height: 100%;
    width: 100%;
}

.page-sider {
    height: 100%;

    .page-sider-inner {
        height: 100%;
        padding: 0;
        gap: 0 !important;
    }
}

/* 作品信息 */
.project-info {
    flex-shrink: 0;
    padding: $spacing-lg $spacing-md;
    gap: $spacing-xs !important;

    .project-type-tag {
        width: fit-content;
        font-size: $font-xs;
    }

    .project-name {
        width: 100%;
        font-size: $font-md;
        font-weight: $font-semibold;
        color: var(--text-primary);
        line-height: 1.2;
    }

    .project-tags {
        margin-top: $spacing-xs;
        gap: $spacing-xs;

        .project-count-tag {
            font-size: $font-xs;
        }
    }
}

/* 文件树 */
.file-tree-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: $spacing-md;
}

/* 页面编辑区：撑满 sider 右侧剩余宽度，并作为右侧悬浮大纲的定位容器 */
.page-content {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: row;
}

.editor-wrap {
    flex: 1;
    min-width: 0;
}

.content-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}
</style>
