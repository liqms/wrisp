<template>
  <n-flex vertical size="large" class="template-settings">
    <n-card size="medium" :bordered="false" class="setting-card">
      <!-- 社区模板市场 -->
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.MARKETPLACE_TITLE") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.MARKETPLACE_DESC") }}</n-text>
        </n-flex>
        <n-button type="primary" size="small" @click="enterMarketplace">
          {{ t("SETTINGS.TEMPLATE_SETTINGS.ENTER_MARKETPLACE") }}
        </n-button>
      </n-flex>
      <n-divider />
      <!-- 当前已安装模板 -->
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.CURRENT_TEMPLATES") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.CURRENT_TEMPLATES_DESC") }}</n-text>
        </n-flex>
        <n-button type="primary" size="small" :loading="syncing" @click="onSyncNow">
          {{ t("SETTINGS.TEMPLATE_SETTINGS.SYNC_NOW") }}
        </n-button>
      </n-flex>
    </n-card>

    <!-- 已安装命令模板列表 -->
    <n-card size="medium" :bordered="false" class="setting-card">
      <template #header>
        <n-flex justify="space-between" align="center" class="card-header">
          <n-flex align="flex-start" class="setting-content">
            <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH") }}</n-text>
            <n-text class="setting-desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH_DESC") }}</n-text>
          </n-flex>
          <n-button type="primary" size="small" @click="openCreate(TEMPLATE_TYPE.SLASH)">
            {{ t("ACTION.COMMON.CREATE") }}
          </n-button>
        </n-flex>
      </template>
      <n-flex class="template-list">
        <TemplateItemCard v-for="item in slashTemplates" :key="item.id" :template="item" @view="() => onView(item)"
          @edit="() => openEdit(TEMPLATE_TYPE.SLASH, item)" @delete="() => onDelete(TEMPLATE_TYPE.SLASH, item)"
          @toggle="(value) => onToggle(TEMPLATE_TYPE.SLASH, item, value)" />
      </n-flex>
    </n-card>

    <!-- 已安装页面模板列表 -->
    <n-card size="medium" :bordered="false" class="setting-card">
      <template #header>
        <n-flex justify="space-between" align="center" class="card-header">
          <n-flex align="flex-start" class="setting-content">
            <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE") }}</n-text>
            <n-text class="setting-desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE_DESC") }}</n-text>
          </n-flex>
          <n-button type="primary" size="small" @click="openCreate(TEMPLATE_TYPE.PAGE)">
            {{ t("ACTION.COMMON.CREATE") }}
          </n-button>
        </n-flex>
      </template>
      <n-flex class="template-list">
        <TemplateItemCard v-for="item in pageTemplates" :key="item.id" :template="item" @view="() => onView(item)"
          @edit="() => openEdit(TEMPLATE_TYPE.PAGE, item)" @delete="() => onDelete(TEMPLATE_TYPE.PAGE, item)"
          @toggle="(value) => onToggle(TEMPLATE_TYPE.PAGE, item, value)" />
      </n-flex>
    </n-card>
  </n-flex>

  <TemplateEditModal v-model:show="editVisible" :template="editingTemplate" @save="onSave" />
  <TemplateViewModal v-model:show="viewVisible" :template="viewingTemplate" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
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
import TemplateItemCard from "./TemplateItem.vue";
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

// 本页分「命令模板 / 页面模板」两个区块展示，进入即加载两类模板
if (!store.isLoaded(TEMPLATE_TYPE.SLASH)) store.fetch(TEMPLATE_TYPE.SLASH);
if (!store.isLoaded(TEMPLATE_TYPE.PAGE)) store.fetch(TEMPLATE_TYPE.PAGE);

const slashTemplates = computed<TemplateItem[]>(() =>
  store.allTemplates(TEMPLATE_TYPE.SLASH, locale.value),
);

const pageTemplates = computed<TemplateItem[]>(() =>
  store.allTemplates(TEMPLATE_TYPE.PAGE, locale.value),
);

const editVisible = ref(false);
const editingTemplate = ref<CustomTemplate | null>(null);

// 内置模板只读查看弹窗状态
const viewVisible = ref(false);
const viewingTemplate = ref<TemplateItem | null>(null);

function onView(item: TemplateItem) {
  viewingTemplate.value = item;
  viewVisible.value = true;
}

// 新建模板类型由所在区块（命令模板 / 页面模板）决定
let pendingType: TemplateType = TEMPLATE_TYPE.SLASH;

function openCreate(type: TemplateType) {
  pendingType = type;
  editingTemplate.value = null;
  editVisible.value = true;
}

function openEdit(type: TemplateType, item: TemplateItem) {
  pendingType = type;
  editingTemplate.value = {
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    markdown: item.markdown,
    profession: item.profession,
    enabled: item.enabled,
  };
  editVisible.value = true;
}

async function onSave(tpl: CustomTemplate) {
  const ok = await store.saveCustom(pendingType, tpl);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.SAVED"));
  else message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

async function onDelete(type: TemplateType, item: TemplateItem) {
  // 仅自定义模板有删除入口，直接移除对应类型下的自定义模板
  const ok = await store.removeCustom(type, item.id);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.DELETED"));
  else message.error(t("ERROR.TEMPLATE.DELETE_FAILED"));
}

async function onToggle(type: TemplateType, item: TemplateItem, enabled: boolean) {
  const ok = await store.setEnabled(type, item.id, item.builtIn, enabled);
  if (!ok) message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables.scss" as *;

/* 避开外层 n-scrollbar 的悬浮滚动条轨道，防止内容被遮挡 */
.template-settings {
  padding-right: 12px;
  width: 100%;
  gap: $spacing-md;
}

.setting-card {
  background-color: var(--bg-secondary);
  border-radius: $radius-md;
}

.setting-row {
  margin-bottom: $spacing-md;
  align-items: center;
  min-height: 34px;
  justify-content: space-between !important;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-content {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 0 !important;
}

.setting-label {
  width: 130px;
  font-size: $font-base;
  margin-bottom: $spacing-xs;
}

.setting-desc {
  font-size: $font-xs;
  color: var(--text-third);
}

/* 卡片标题栏：左侧类型名/描述，右侧新建按钮 */
.card-header {
  width: 100%;
}

/* 已安装模板卡片列表：纵向排列、卡片占满整行 */
.template-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  width: 100%;
}
</style>
