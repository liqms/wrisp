<template>
  <n-scrollbar class="template-settings">
    <!-- 社区模板市场 -->
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.MARKETPLACE_TITLE") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.MARKETPLACE_DESC") }}</n-text>
        </n-flex>
        <n-button tertiary @click="enterMarketplace" class="button">
          {{ t("SETTINGS.TEMPLATE_SETTINGS.ENTER_MARKETPLACE") }}
        </n-button>
      </n-flex>
    </n-card>

    <!-- 当前已安装模板 -->
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.CURRENT_TEMPLATES") }}</n-text>
          <n-text class="setting-desc">{{
            t("SETTINGS.TEMPLATE_SETTINGS.CURRENT_TEMPLATES_DESC", { added: installedCount })
          }}</n-text>
        </n-flex>
        <n-button tertiary :loading="syncing" @click="onSyncNow" class="button">
          {{ t("SETTINGS.TEMPLATE_SETTINGS.SYNC_NOW") }}
        </n-button>
      </n-flex>
    </n-card>

    <!-- 命令模板 -->
    <n-card size="medium" :bordered="false" class="setting-card nav-card clickable"
      @click="emit('navigate', PAGE_SLASH)">
      <n-flex class="setting-nav-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH_DESC") }}</n-text>
        </n-flex>
        <n-icon class="nav-arrow">
          <ChevronForward />
        </n-icon>
      </n-flex>
    </n-card>

    <!-- 页面模板 -->
    <n-card size="medium" :bordered="false" class="setting-card nav-card clickable"
      @click="emit('navigate', PAGE_PAGE)">
      <n-flex class="setting-nav-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE_DESC") }}</n-text>
        </n-flex>
        <n-icon class="nav-arrow">
          <ChevronForward />
        </n-icon>
      </n-flex>
    </n-card>
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { ChevronForward } from "@vicons/ionicons5";
import type { AppConfig } from "@/shared/types";
import type { SyncResult } from "@/shared/types/resource.types";
import type { TemplateItem } from "@/shared/types/template.types";
import { useConfig } from "@/renderer/composables/useConfig";
import { useTemplateStore } from "@/renderer/store/template.store";
import {
  TEMPLATE_TYPE,
  type TemplateType,
} from "@/shared/enums/template.enums";

const PAGE_SLASH = "template.slash";
const PAGE_PAGE = "template.page";

// 设置页通过 SettingsView 统一传入 config（本组件使用 store 读取配置，此处声明以接收该 prop）
defineProps<{ config?: AppConfig | null }>();

const emit = defineEmits<{
  /** 请求关闭设置弹窗并跳转模板市场 */
  (e: "enterMarketplace"): void;
  /** 请求跳转到模板子页面 */
  (e: "navigate", pageKey: string): void;
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
  // 进入页面即加载两类模板，用于展示已安装数量
  if (!store.isLoaded(TEMPLATE_TYPE.SLASH)) store.fetch(TEMPLATE_TYPE.SLASH);
  if (!store.isLoaded(TEMPLATE_TYPE.PAGE)) store.fetch(TEMPLATE_TYPE.PAGE);
  offUpdated = window.electronAPI.resource.onUpdated((changedTypes) => {
    // 把 ResourceType 映射到 TemplateType 并失效缓存
    const types: TemplateType[] = [];
    if (changedTypes.includes(TEMPLATE_TYPE.SLASH)) types.push(TEMPLATE_TYPE.SLASH);
    if (changedTypes.includes(TEMPLATE_TYPE.PAGE)) types.push(TEMPLATE_TYPE.PAGE);
    if (types.length > 0) {
      store.invalidate(types);
      for (const t of types) store.fetch(t);
    }
  });
});

onUnmounted(() => {
  offUpdated?.();
});

const slashTemplates = computed<TemplateItem[]>(() =>
  store.allTemplates(TEMPLATE_TYPE.SLASH, locale.value),
);

const pageTemplates = computed<TemplateItem[]>(() =>
  store.allTemplates(TEMPLATE_TYPE.PAGE, locale.value),
);

// 已安装模板总数（用于顶部描述文案）
const installedCount = computed(() => slashTemplates.value.length + pageTemplates.value.length);
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables.scss" as *;

.template-settings {
  max-height: 100%;
  /* 避开外层 n-scrollbar 的悬浮滚动条轨道，防止内容被遮挡 */
  padding-right: 12px;
}

.setting-card {
  margin-bottom: $spacing-md;
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

.setting-nav-row {
  align-items: center;
  justify-content: space-between !important;
}

.setting-content {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 0 !important;
  max-width: calc(100% - 100px);
}

.setting-label {
  font-size: $font-base;
}

.setting-desc {
  font-size: $font-xs;
  color: var(--text-third);
}

.nav-arrow {
  color: var(--text-third);
  flex-shrink: 0;
}
</style>
