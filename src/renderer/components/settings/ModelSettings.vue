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
    <n-card size="medium" :bordered="false" class="setting-card" v-if="enableCloudAi">
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
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDialog } from "naive-ui";
import { useModel } from "@/renderer/composables";
import type { AIProvider } from "@/shared/types";
import { logger } from "@/renderer/utils/logger.utils";
import ProviderItem from "./ProviderItem.vue";
import AddProviderModal from "./AddProviderModal.vue";
import ModelDefault from "./ModelDefault.vue";

const { t } = useI18n();
const dialog = useDialog();
const { providers, enableAiMode, enableCloudAi, updateEnableAiMode, updateEnableCloudAi, addOrUpdateAIProvider, deleteAIProvider } = useModel();
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
