<template>
  <!-- 顶部：类型名/描述 + 新建按钮 -->
  <n-card size="medium" :bordered="false" class="setting-card">
    <n-flex class="setting-row">
      <n-flex align="center" class="setting-content">
        <n-text class="setting-label">{{ t(labelKey) }}</n-text>
        <n-text class="setting-desc">{{ t(descKey) }}</n-text>
      </n-flex>
      <n-button type="primary" @click="openCreate">
        {{ t("ACTION.COMMON.CREATE") }}
      </n-button>
    </n-flex>
  </n-card>

  <!-- 已安装模板列表 -->
  <n-flex v-if="templates.length > 0" class="ai-mode-list" wrap>
    <TemplateItemCard v-for="item in templates" :key="item.id" :template="item" @view="() => onView(item)"
      @edit="() => openEdit(item)" @delete="() => onDelete(item)" @toggle="(value) => onToggle(item, value)" />
  </n-flex>

  <TemplateEditModal v-model:show="editVisible" :template="editingTemplate" @save="onSave" />
  <TemplateViewModal v-model:show="viewVisible" :template="viewingTemplate" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
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

const props = defineProps<{ type: TemplateType }>();

const { t } = useI18n();
const message = useMessage();
const { locale } = useConfig();
const store = useTemplateStore();

const isSlash = computed(() => props.type === TEMPLATE_TYPE.SLASH);
const labelKey = computed(() =>
  isSlash.value
    ? "SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH"
    : "SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE",
);
const descKey = computed(() =>
  isSlash.value
    ? "SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH_DESC"
    : "SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE_DESC",
);

const templates = computed<TemplateItem[]>(() =>
  store.allTemplates(props.type, locale.value),
);

let offUpdated: (() => void) | null = null;

onMounted(() => {
  if (!store.isLoaded(props.type)) store.fetch(props.type);
  offUpdated = window.electronAPI.resource.onUpdated((changedTypes) => {
    // 只刷新当前子页面展示的模板类型
    if (changedTypes.includes(props.type)) {
      store.invalidate([props.type]);
      store.fetch(props.type);
    }
  });
});

onUnmounted(() => {
  offUpdated?.();
});

const editVisible = ref(false);
const editingTemplate = ref<CustomTemplate | null>(null);

const viewVisible = ref(false);
const viewingTemplate = ref<TemplateItem | null>(null);

function onView(item: TemplateItem) {
  viewingTemplate.value = item;
  viewVisible.value = true;
}

function openCreate() {
  editingTemplate.value = null;
  editVisible.value = true;
}

function openEdit(item: TemplateItem) {
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
  const ok = await store.saveCustom(props.type, tpl);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.SAVED"));
  else message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

async function onDelete(item: TemplateItem) {
  // 仅自定义模板有删除入口，直接移除对应类型下的自定义模板
  const ok = await store.removeCustom(props.type, item.id);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.DELETED"));
  else message.error(t("ERROR.TEMPLATE.DELETE_FAILED"));
}

async function onToggle(item: TemplateItem, enabled: boolean) {
  const ok = await store.setEnabled(props.type, item.id, item.builtIn, enabled);
  if (!ok) message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables.scss" as *;

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

/* 已安装模板列表：与模型服务商列表页一致，纵向排列、卡片占满整行 */
.ai-mode-list {
  gap: $spacing-sm;
  flex-wrap: wrap;
}
</style>
