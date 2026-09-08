<template>
  <n-flex vertical size="large" class="template-settings">
    <n-flex justify="space-between" align="center">
      <div>
        <div class="title">{{ t("SETTINGS.TEMPLATE_SETTINGS.TITLE") }}</div>
        <div class="desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.DESC") }}</div>
      </div>
      <n-flex align="center" :size="8">
        <n-button type="primary" @click="enterMarketplace">
          <template #icon><n-icon>
              <StorefrontOutlined />
            </n-icon></template>
          {{ t("SETTINGS.TEMPLATE_SETTINGS.ENTER_MARKETPLACE") }}
        </n-button>
        <!-- 新建支持选择命令/页面模板类型 -->
        <n-dropdown trigger="click" :options="createOptions" @select="openCreate">
          <n-button type="primary">
            {{ t("SETTINGS.TEMPLATE_SETTINGS.ADD") }}
            <n-icon style="margin-left: 4px">
              <ChevronDown />
            </n-icon>
          </n-button>
        </n-dropdown>
        <n-button :loading="syncing" @click="onSyncNow">
          {{ t("SETTINGS.TEMPLATE_SETTINGS.SYNC_NOW") }}
        </n-button>
      </n-flex>
    </n-flex>

    <n-tabs v-model:value="activeType" type="line" size="small">
      <n-tab :name="TEMPLATE_TYPE.SLASH" :tab="t('SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH')" />
      <n-tab :name="TEMPLATE_TYPE.PAGE" :tab="t('SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE')" />
    </n-tabs>

    <n-flex align="center" :size="8">
      <n-button size="small" :type="filterProfession === '' ? 'primary' : 'default'" @click="filterProfession = ''">
        {{ t("SETTINGS.TEMPLATE_SETTINGS.ALL") }}
      </n-button>
      <n-button v-for="opt in professionOptions" :key="opt.value" size="small"
        :type="filterProfession === opt.value ? 'primary' : 'default'" @click="filterProfession = opt.value">
        {{ opt.label }}
      </n-button>
    </n-flex>

    <n-data-table :columns="columns" :data="filteredTemplates" :bordered="false"
      :row-key="(row: TemplateItem) => row.id" :max-height="tableMaxHeight" />
  </n-flex>

  <TemplateEditModal v-model:show="editVisible" :template="editingTemplate" @save="onSave" />
  <TemplateViewModal v-model:show="viewVisible" :template="viewingTemplate" />
</template>

<script setup lang="ts">
import { ref, computed, h, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NSwitch, NTag, useMessage } from "naive-ui";
import type { DropdownOption } from "naive-ui";
import { ChevronDown } from "@vicons/ionicons5";
import { StorefrontOutlined } from "@vicons/material";
import type { DataTableColumns } from "naive-ui";
import { PROFESSION, type Profession } from "@/shared/enums";
import type { AppConfig } from "@/shared/types";
import type { SyncResult } from "@/shared/types/resource.types";
import { useConfig } from "@/renderer/composables/useConfig";
import { useTemplateStore } from "@/renderer/store/template.store";
import type {
  CustomTemplate,
  TemplateItem,
} from "@/shared/types/template.types";
import {
  TEMPLATE_TYPE,
  type TemplateType,
} from "@/shared/enums/template.enums";
import TemplateEditModal from "./TemplateEditModal.vue";
import TemplateViewModal from "./TemplateViewModal.vue";

// 设置页通过 SettingsView 统一传入 config（本组件使用 store 读取配置，此处声明以接收该 prop）
defineProps<{ config?: AppConfig | null }>();

const emit = defineEmits<{
  /** 请求关闭设置弹窗并跳转模板市场 */
  (e: "enterMarketplace"): void;
}>();

function enterMarketplace() {
  emit("enterMarketplace");
}

const { t } = useI18n();
const message = useMessage();
const { locale } = useConfig();
const store = useTemplateStore();

// 监听 resource:updated 事件，刷新 store
const syncing = ref(false);
let offUpdated: (() => void) | null = null;

async function onSyncNow() {
  if (syncing.value) return;
  syncing.value = true;
  try {
    const res = await window.electronAPI.resource.syncNow();
    // ApiResponse 为联合类型（含 ListResponse），先排除数组形态再取 SyncResult
    const result = (res.data && !Array.isArray(res.data) ? res.data : null) as SyncResult | null;
    if (!res.success || !result) {
      message.error(t("SETTINGS.TEMPLATE_SETTINGS.SYNC_FAILED"));
      return;
    }
    if (!result.success) {
      message.error(
        `${t("SETTINGS.TEMPLATE_SETTINGS.SYNC_FAILED")}${result.error ? `: ${result.error}` : ""}`,
      );
      return;
    }
    if (result.added.length + result.updated.length === 0) {
      message.success(t("SETTINGS.TEMPLATE_SETTINGS.SYNC_UP_TO_DATE"));
    } else {
      message.success(
        t("SETTINGS.TEMPLATE_SETTINGS.SYNC_UPDATED", {
          added: result.added.length,
          updated: result.updated.length,
        }),
      );
    }
  } catch {
    message.error(t("SETTINGS.TEMPLATE_SETTINGS.SYNC_FAILED"));
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  offUpdated = window.electronAPI.resource.onUpdated((changedTypes) => {
    // 把 ResourceType 映射到 TemplateType 并失效缓存
    const types: TemplateType[] = [];
    if (changedTypes.includes("slash" as never)) types.push(TEMPLATE_TYPE.SLASH);
    if (changedTypes.includes("page" as never)) types.push(TEMPLATE_TYPE.PAGE);
    if (types.length > 0) {
      store.invalidate(types);
      for (const t of types) store.fetch(t);
    }
  });
});

onUnmounted(() => {
  offUpdated?.();
});

// 当前管理的模板类型（slash / page），切换时按需懒加载
const activeType = ref<TemplateType>(TEMPLATE_TYPE.SLASH);

if (!store.isLoaded(activeType.value)) store.fetch(activeType.value);
watch(activeType, (type) => {
  if (!store.isLoaded(type)) store.fetch(type);
});

const filterProfession = ref<Profession | "">("");

const professionOptions = (Object.values(PROFESSION) as Profession[]).map(
  (value) => ({
    label: t(`SETTINGS.PROFESSION.OPTION_${value.toUpperCase()}`),
    value,
  }),
);

const allTemplates = computed<TemplateItem[]>(() =>
  store.allTemplates(activeType.value, locale.value),
);

const filteredTemplates = computed<TemplateItem[]>(() => {
  const list = allTemplates.value;
  if (!filterProfession.value) return list;
  return list.filter((item) => item.profession === filterProfession.value);
});

// 仅让表格内部滚动（表头固定），避免整个设置页滚动。
// 高度需预留头部/Tab/职业筛选行与间距（约 200px），否则内容超出 60vh 触发外层滚动条
const tableMaxHeight = computed(() => "calc(60vh - 200px)");

const editVisible = ref(false);
const editingTemplate = ref<CustomTemplate | null>(null);

// 内置模板只读查看弹窗状态
const viewVisible = ref(false);
const viewingTemplate = ref<TemplateItem | null>(null);

function onView(row: TemplateItem) {
  viewingTemplate.value = row;
  viewVisible.value = true;
}

// 新建模板类型选择（命令模板 / 页面模板）
const createOptions = computed<DropdownOption[]>(() => [
  {
    label: t("SETTINGS.TEMPLATE_SETTINGS.CREATE_SLASH"),
    key: TEMPLATE_TYPE.SLASH,
  },
  {
    label: t("SETTINGS.TEMPLATE_SETTINGS.CREATE_PAGE"),
    key: TEMPLATE_TYPE.PAGE,
  },
]);

// 待保存的模板类型：新建时由下拉选择决定，编辑时为当前 Tab 类型
let pendingType: TemplateType = TEMPLATE_TYPE.SLASH;

function openCreate(type: string | number) {
  pendingType = type as TemplateType;
  editingTemplate.value = null;
  editVisible.value = true;
}

function openEdit(row: TemplateItem) {
  // 编辑仅针对当前 Tab 列表中的自定义模板
  pendingType = activeType.value;
  editingTemplate.value = {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    markdown: row.markdown,
    profession: row.profession,
    enabled: row.enabled,
  };
  editVisible.value = true;
}

async function onSave(tpl: CustomTemplate) {
  const ok = await store.saveCustom(pendingType, tpl);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.SAVED"));
  else message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

async function onDelete(row: TemplateItem) {
  // 仅「自定义」职业的模板有删除入口，直接移除当前类型下的自定义模板
  const ok = await store.removeCustom(activeType.value, row.id);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.DELETED"));
  else message.error(t("ERROR.TEMPLATE.DELETE_FAILED"));
}

async function onToggle(row: TemplateItem, enabled: boolean) {
  const ok = await store.setEnabled(
    activeType.value,
    row.id,
    row.builtIn,
    enabled,
  );
  if (!ok) message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

const columns: DataTableColumns<TemplateItem> = [
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.NAME"),
    key: "title",
    minWidth: 140,
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.PROFESSION"),
    key: "profession",
    width: 110,
    render: (row) => t(`SETTINGS.PROFESSION.OPTION_${row.profession.toUpperCase()}`),
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.META_TAGS"),
    key: "tags",
    width: 150,
    render: (row) =>
      row.tags.length === 0
        ? "—"
        : h(
          "div",
          // 多标签间距 + 允许换行（窄列下长标签自动折行）
          { style: "display: flex; flex-wrap: wrap; gap: 4px; row-gap: 4px;" },
          row.tags.map((tag) =>
            h(NTag, { size: "small", bordered: false }, { default: () => tag }),
          ),
        ),
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.VERSION"),
    key: "version",
    width: 80,
    render: (row) => row.version || "—",
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.ENABLED"),
    key: "enabled",
    width: 80,
    render: (row) =>
      h(NSwitch, {
        value: row.enabled,
        onUpdateValue: (v: boolean) => onToggle(row, v),
      }),
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.ACTIONS"),
    key: "actions",
    width: 140,
    render: (row) =>
      row.profession === PROFESSION.CUSTOM
        ? [
          h(
            NButton,
            { size: "small", quaternary: true, onClick: () => openEdit(row) },
            { default: () => t("SETTINGS.TEMPLATE_SETTINGS.EDIT") },
          ),
          h(
            NButton,
            {
              size: "small",
              quaternary: true,
              type: "error",
              onClick: () => onDelete(row),
            },
            { default: () => t("SETTINGS.TEMPLATE_SETTINGS.DELETE") },
          ),
        ]
        : [
          // 内置模板仅支持查看（只读）
          h(
            NButton,
            { size: "small", quaternary: true, onClick: () => onView(row) },
            { default: () => t("SETTINGS.TEMPLATE_SETTINGS.VIEW") },
          ),
        ],
  },
];
</script>

<style scoped lang="scss">
/* 避开外层 n-scrollbar 的悬浮滚动条轨道，防止「新建」按钮被遮挡 */
.template-settings {
  padding-right: 12px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.desc {
  font-size: 12px;
  color: var(--text-third);
  margin-top: 4px;
}
</style>
