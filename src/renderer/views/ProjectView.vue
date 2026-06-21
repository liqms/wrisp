<template>
  <n-flex vertical class="project-view">
    <!-- 顶部：搜索框 + 新建按钮 -->
    <n-flex class="toolbar" justify="space-between" align="center">
      <n-input v-model:value="searchKeyword" :placeholder="t('TIPS.SEARCH.SEARCH_PROJECT')" clearable :loading="loading"
        class="search-input" @keyup.enter="handleSearch">
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

    <!-- 中部：作品列表 -->
    <n-data-table remote :columns="columnsRef" :data="dataRef" :loading="loading" :pagination="paginationReactive"
      @update:page="handlePageChange" :bordered="false" :single-line="false" class="project-table" />

    <!-- 新建/编辑对话框 -->
    <n-modal v-model:show="showModal" :title="isEditing ? t('ACTION.EDIT.EDIT_PROJECT') : t('ACTION.NEW.PROJECT')"
      preset="card" style="width: 520px" :mask-closable="false">
      <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
        <n-form-item :label="t('TIPS.PROJECT.PROJECT_NAME')" path="name">
          <n-input v-model:value="formData.name" :placeholder="t('TIPS.PROJECT.INPUT_PROJECT_NAME')" />
        </n-form-item>
        <n-form-item :label="t('TIPS.PROJECT.PROJECT_TYPE')" path="type">
          <n-select v-model:value="formData.type" :options="typeOptions"
            :placeholder="t('TIPS.PROJECT.SELECT_PROJECT_TYPE')" />
        </n-form-item>
        <n-form-item :label="t('TIPS.PROJECT.PROJECT_DESCRIPTION')" path="description">
          <n-input v-model:value="formData.description" type="textarea"
            :placeholder="t('TIPS.PROJECT.INPUT_PROJECT_DESCRIPTION')" :rows="3" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-flex justify="flex-end" :gap="12">
          <n-button @click="showModal = false">{{ t('ACTION.COMMON.CANCEL') }}</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEditing ? t('ACTION.COMMON.SAVE') : t('ACTION.COMMON.CREATE') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, reactive } from "vue";
import { useMessage, NButton, NIcon, NTag, NSpace, NPopconfirm } from "naive-ui";
import { Search, Add, Create, Trash } from "@vicons/ionicons5";
import { useProject } from "@/renderer/composables/useProject";
import type { ProjectCreate, ProjectUpdate, ProjectDetail, Tag } from "@/main/types/db";
import { PROJECT_TYPE } from "@/shared/enums";
import type {
  FormInst, FormRules, DataTableColumn, PaginationInfo
} from "naive-ui";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

const message = useMessage();

const {
  projects,
  loading,
  pagination,
  paginateProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectDetail,
} = useProject();

// 搜索
const searchKeyword = ref("");
const handleSearch = async () => {
  await paginateProjects({
    page: paginationReactive.page || 1,
    pageSize: paginationReactive.pageSize || 20,
    orderBy: "updated_at",
    orderDir: "DESC",
    conditions: searchKeyword.value ? { name: searchKeyword.value } : undefined,
  });
  syncTableData();
};

// 同步表格数据和分页状态
const syncTableData = () => {
  paginationReactive.page = pagination.value?.page || 1;
  paginationReactive.pageSize = pagination.value?.pageSize || 20;
  paginationReactive.itemCount = pagination.value?.total || 0;
  paginationReactive.pageCount = pagination.value?.totalPages || 0;
  paginationReactive.startIndex = pagination.value?.startIndex || 0;
  paginationReactive.endIndex = pagination.value?.endIndex || 0;
  dataRef.value = projects.value?.map((item, index) => ({
    rowIndex: index + (paginationReactive.startIndex || 0) + 1,
    id: item.id,
    name: item.name,
    type: item.type,
    tags: item.tags,
    block_count: item.block_count,
    page_count: item.page_count,
    updated_at: formatTime(item.updated_at),
  })) || [];
};

// 分页
const handlePageChange = async (page: number) => {
  await paginateProjects({
    page,
    pageSize: paginationReactive.pageSize,
    orderBy: "updated_at",
    orderDir: "DESC",
    conditions: searchKeyword.value ? { name: searchKeyword.value } : undefined,
  });
  syncTableData();
};

// 类型映射
const typeLabelMap = computed(() => ({
  [PROJECT_TYPE.NOVEL]: t('APP.PROJECT_TYPE.NOVEL'),
  [PROJECT_TYPE.SERIES]: t('APP.PROJECT_TYPE.SERIES'),
  [PROJECT_TYPE.BOOK]: t('APP.PROJECT_TYPE.BOOK'),
  [PROJECT_TYPE.RESEARCH]: t('APP.PROJECT_TYPE.RESEARCH'),
  [PROJECT_TYPE.PRODUCT]: t('APP.PROJECT_TYPE.PRODUCT'),
}));

const typeOptions = computed(() => [
  { label: t('APP.PROJECT_TYPE.NOVEL'), value: PROJECT_TYPE.NOVEL },
  { label: t('APP.PROJECT_TYPE.SERIES'), value: PROJECT_TYPE.SERIES },
  { label: t('APP.PROJECT_TYPE.BOOK'), value: PROJECT_TYPE.BOOK },
  { label: t('APP.PROJECT_TYPE.RESEARCH'), value: PROJECT_TYPE.RESEARCH },
  { label: t('APP.PROJECT_TYPE.PRODUCT'), value: PROJECT_TYPE.PRODUCT },
]);

// 格式化时间
const formatTime = (timestamp: string): string => {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// 表格列定义
interface RowData {
  rowIndex: number
  id: string
  name: string
  type: string
  tags?: Tag[]
  block_count?: number
  page_count?: number
  updated_at: string
}



const columns = computed((): DataTableColumn<RowData>[] => [
  {
    title: t('APP.BASE.ROW_INDEX'),
    key: "rowIndex",
    width: 60,
  },
  {
    title: t('TIPS.PROJECT.PROJECT_NAME'),
    key: "name",
    ellipsis: { tooltip: true },
    width: 200,
  },
  {
    title: t('TIPS.PROJECT.PROJECT_TYPE'),
    key: "type",
    width: 120,
    render(row) {
      return typeLabelMap.value[row.type as keyof typeof typeLabelMap.value] || row.type;
    },
  },
  {
    title: t('TIPS.PROJECT.PROJECT_TAGS'),
    key: "tags",
    width: 200,
    render(row) {
      const tags = row.tags;
      if (!tags || tags.length === 0) return "-";
      return h(NSpace, { size: "small", wrap: true }, () =>
        tags!.map((tag) =>
          h(
            NTag,
            { size: "small", color: { color: tag.color } },
            { default: () => tag.name },
          ),
        ),
      );
    },
  },
  {
    title: () => t('TIPS.COMMON.BLOCK_COUNT'),
    key: "block_count",
    width: 100,
    render(row) {
      const count = row.block_count;
      return count ?? "-";
    },
  },
  {
    title: () => t('TIPS.COMMON.PAGE_COUNT'),
    key: "page_count",
    width: 100,
    render(row) {
      const count = row.page_count;
      return count ?? "-";
    },
  },
  {
    title: () => t('TIPS.COMMON.WORD_COUNT'),
    key: "updated_at",
    width: 160,
    render(row) {
      return formatTime(row.updated_at);
    },
  },
  {
    title: () => t('ACTION.COMMON.EDIT'),
    key: "actions",
    width: 140,
    render(row) {
      return h(NSpace, { size: "small" }, () => [
        h(
          NButton,
          {
            size: "small",
            quaternary: true,
            type: "primary",
            onClick: () => openEditModal(row.id),
          },
          {
            icon: () => h(NIcon, null, { default: () => h(Create) }),
          },
        ),
        h(
          NPopconfirm,
          {
            onPositiveClick: () => handleDelete(row.id),
          },
          {
            trigger: () =>
              h(
                NButton,
                {
                  size: "small",
                  quaternary: true,
                  type: "error",
                },
                {
                  icon: () => h(NIcon, null, { default: () => h(Trash) }),
                },
              ),
            default: () => t('ACTION.DELETE.DELETE_PROJECT'),
          },
        ),
      ]);
    },
  },
]);

const dataRef = ref<RowData[]>([]);
const columnsRef = computed(() => columns.value);
const paginationReactive = reactive<PaginationInfo>({
  startIndex: 0,
  endIndex: 0,
  page: 1,
  pageSize: 20,
  pageCount: 0,
  itemCount: 0,
});



// 新建/编辑对话框
const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<string | null>(null);
const submitting = ref(false);
const formRef = ref<FormInst | null>(null);

const formData = ref<{ name: string; type: string; description: string; tags: Tag[] }>({
  name: "",
  type: PROJECT_TYPE.NOVEL,
  description: "",
  tags: [],
});

const formRules: FormRules = {
  name: [
    { required: true, message: t('TIPS.PROJECT.INPUT_PROJECT_NAME'), trigger: "blur" },
    { min: 1, max: 100, message: t('TIPS.PROJECT.PROJECT_NAME_LENGTH_LIMIT'), trigger: "blur" },
  ],
  type: [{ required: true, message: t('TIPS.PROJECT.SELECT_PROJECT_TYPE'), trigger: "change" }],
};

const openCreateModal = () => {
  isEditing.value = false;
  editingId.value = null;
  formData.value = { name: "", type: PROJECT_TYPE.NOVEL, description: "", tags: [] };
  showModal.value = true;
};

const openEditModal = async (id: string) => {
  isEditing.value = true;
  editingId.value = id;
  const ProjectDetail = await getProjectDetail(id) as ProjectDetail;
  if (!ProjectDetail) {
    message.error(t('ERROR.CREATION.NOT_FOUND'));
    return;
  }
  formData.value = {
    name: ProjectDetail.name,
    type: ProjectDetail.type,
    description: ProjectDetail.description || "",
    tags: ProjectDetail.tags || [],
  };
  showModal.value = true;
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  submitting.value = true;
  try {
    if (isEditing.value && editingId.value) {
      const updateData: ProjectUpdate = {
        name: formData.value.name,
        type: formData.value.type as any,
        description: formData.value.description || undefined,
      };
      const success = await updateProject(editingId.value, updateData);
      if (success) {
        message.success(t('NOTIFICATION.SUCCESS'));
        showModal.value = false;
        handleSearch();
      } else {
        message.error(t('NOTIFICATION.ERROR'));
      }
    } else {
      const createData: ProjectCreate = {
        name: formData.value.name,
        type: formData.value.type as any,
        description: formData.value.description || undefined,
      };
      const id = await createProject(createData);
      if (id) {
        message.success(t('NOTIFICATION.SUCCESS'));
        showModal.value = false;
        handleSearch();
      } else {
        message.error(t('NOTIFICATION.ERROR'));
      }
    }
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (id: string) => {
  const success = await deleteProject(id);
  if (success) {
    message.success(t('NOTIFICATION.SUCCESS'));
    handleSearch();
  } else {
    message.error(t('NOTIFICATION.ERROR'));
  }
};

// 初始化加载
onMounted(() => {
  handleSearch();
});
</script>

<style scoped lang="scss">
.project-view {
  padding: 24px;
  height: 100%;
  gap: 16px;

  .toolbar {
    flex-shrink: 0;

    .search-input {
      width: 320px;
    }
  }

  .project-table {
    flex: 1;
    overflow: auto;
  }

  .pagination-bar {
    flex-shrink: 0;
  }
}
</style>
