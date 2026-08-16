<template>
  <n-scrollbar class="model-settings">
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE")
          }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE_DESC") }}{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE_DESC_3")
          }}</n-text>
        </n-flex>
        <n-switch :value="enableAiMode" class="setting-switch" @update:value="updateEnableAiMode" />
      </n-flex>
      <n-flex v-if="enableAiMode" class="models-item">
        <DownloadButton v-for="model in modelList" :key="model.id" :title="model.label" :desc="model.desc"
          :progress="model.progress" :localpath="model.localpath" />
      </n-flex>
    </n-card>
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_CLOUD")
          }}</n-text>
          <n-text class="setting-desc">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_CLOUD_DESC_3")
          }}</n-text>
        </n-flex>
        <n-switch :value="enableCloudAi" class="setting-switch" @update:value="updateEnableCloudAi" />
      </n-flex>
    </n-card>
    <n-card v-if="enableCloudAi" size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.PROVIDER_MODELS")
          }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.PROVIDER_MODELS_DESC") }}</n-text>
        </n-flex>
        <n-button size="medium" type="primary" @click="addProvider">
          {{ t("ACTION.COMMON.ADD") }}
        </n-button>
      </n-flex>
      <n-flex v-if="providers.length > 0" class="ai-mode-list" wrap>
        <ProviderItem v-for="provider in providers" :key="provider.id" :provider="provider"
          @edit="handleEditProvider(provider)" @delete="handleDeleteProvider(provider)"
          @toggle="handleToggleProvider(provider)" />
      </n-flex>
    </n-card>
    <ModelDefault />
    <AddProviderModal v-model:show="showAddModal" :editing-provider="editingProvider" @confirm="handleAddProvider" />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDialog } from "naive-ui";
import { useModel } from "@/renderer/composables";
import type { AIProvider } from "@/shared/types";
import { logger } from "@/renderer/utils/logger.utils";
import ProviderItem from "./ProviderItem.vue";
import AddProviderModal from "./AddProviderModal.vue";
import ModelDefault from "./ModelDefault.vue";
import { useDownloadStore } from "@/renderer/store/download.store";
import DownloadButton from "../base/DownloadButton.vue";

const downloadStore = useDownloadStore();

const { t } = useI18n();
const dialog = useDialog();
const { providers, enableAiMode, enableCloudAi, updateEnableAiMode, updateEnableCloudAi, addOrUpdateAIProvider, deleteAIProvider, checkModelExist } = useModel();
const showAddModal = ref(false);
const editingProvider = ref<AIProvider | null>(null);

function addProvider() {
  editingProvider.value = null;
  showAddModal.value = true;
}

function handleEditProvider(provider: AIProvider) {
  editingProvider.value = provider;
  showAddModal.value = true;
}

async function handleAddProvider(provider: AIProvider) {
  try {
    const success = await addOrUpdateAIProvider(provider);
    if (success) {
      showAddModal.value = false;
    }
  } catch (e) {
    logger.error("添加/更新服务商失败 VUE", { error: e });
  }
}

function handleDeleteProvider(provider: AIProvider) {
  dialog.warning({
    title: t('SETTINGS.AI_SETTINGS.DELETE_PROVIDER_TITLE'),
    content: t('SETTINGS.AI_SETTINGS.DELETE_PROVIDER_CONFIRM', { name: provider.name }),
    positiveText: t('ACTION.COMMON.DELETE'),
    negativeText: t('ACTION.COMMON.CANCEL'),
    style: { width: '360px' },
    onPositiveClick: () => {
      deleteAIProvider(provider.id);
    },
  });
}

async function handleToggleProvider(provider: AIProvider) {
  const updated = { ...provider, enabled: !provider.enabled };
  await addOrUpdateAIProvider(updated);
}

// 模型定义（与后端 model-registry.ts 保持一致）
const MODEL_DEFS = [
  { id: "jina-embeddings-v3", labelKey: "MODELS.EMBEDDINGS", descKey: "MODELS.EMBEDDINGS_DESC" },
  { id: "bge-reranker-v2-m3", labelKey: "MODELS.RERANKER", descKey: "MODELS.RERANKER_DESC" },
] as const;

// 模型下载状态（从后端查询）
const modelExistStatus = ref<Record<string, boolean>>({});
const loadingModelStatus = ref(false);

// 刷新模型下载状态
async function refreshModelStatus() {
  loadingModelStatus.value = true;
  try {
    const result = await checkModelExist();
    if (result) {
      modelExistStatus.value = result;
    }
  } finally {
    loadingModelStatus.value = false;
  }
}

// 模型列表（合并后端状态和下载进度）
const modelList = computed(() => {
  return MODEL_DEFS.map((def) => {
    const exists = modelExistStatus.value[def.id];
    // 从 downloadStore 查找该模型的下载进度
    let progress = 0;
    let localpath = exists ? "downloaded" : "";

    // 遍历所有下载组，查找匹配的文件
    for (const group of downloadStore.allGroupsProgress) {
      if (!group) continue;
      for (const file of group.files) {
        if (file.url.includes(def.id)) {
          progress = file.progress;
          if (file.status === "completed") {
            localpath = file.localPath || "downloaded";
          }
          break;
        }
      }
    }

    return {
      id: def.id,
      label: t(def.labelKey),
      desc: t(def.descKey),
      progress,
      localpath,
    };
  });
});

// 初始化：加载模型状态
onMounted(async () => {
  if (enableAiMode.value) {
    await refreshModelStatus();
  }
});

// 监听 enableAiMode 变化，开启时刷新状态
watch(enableAiMode, (val) => {
  if (val) {
    refreshModelStatus();
  }
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/variables.scss" as *;

.model-settings {
  max-height: 100%;
}

.setting-card {
  margin-bottom: $spacing-md;
  background-color: var(--bg-secondary);
  border-radius: $radius-md;
}

.ai-mode-list {
  gap: 12px;
  flex-wrap: wrap;
}

.config-list {
  gap: 0 !important;
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

.models-item {
  display: flex;
  align-items: center;
  margin-top: $spacing-xs;
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

.setting-select {
  width: 280px;
}
</style>
