<template>
  <n-flex vertical class="welcome-step">
    <n-text class="step-title">{{ t('WELCOME.MODEL_DOWNLOAD.TITLE') }}</n-text>
    <n-text depth="3" class="step-desc">{{ t('WELCOME.MODEL_DOWNLOAD.DESCRIPTION') }}</n-text>

    <n-flex v-if="!downloading" class="model-list" vertical>
      <n-card
        v-for="model in availableModels"
        :key="model.id"
        size="small"
        hoverable
        :class="{ selected: selectedModel === model.id }"
        @click="selectedModel = model.id"
      >
        <n-flex align="center" justify="space-between">
          <n-flex vertical>
            <n-text>{{ model.name }}</n-text>
            <n-text depth="3" class="model-size">{{ model.size }}</n-text>
          </n-flex>
          <n-checkbox :checked="selectedModel === model.id" />
        </n-flex>
      </n-card>
    </n-flex>

    <n-flex v-else class="download-progress" vertical>
      <n-progress :percentage="progress" :indicator-placement="'inside'" />
      <n-text depth="3" class="progress-label">{{ t('WELCOME.MODEL_DOWNLOAD.DOWNLOADING') }}</n-text>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NFlex, NText, NCard, NCheckbox, NProgress } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

export interface ModelOption {
  id: string;
  name: string;
  size: string;
}

withDefaults(
  defineProps<{
    availableModels?: ModelOption[];
    downloading?: boolean;
    progress?: number;
  }>(),
  {
    availableModels: () => [],
    downloading: false,
    progress: 0,
  },
);

const selectedModel = ref("");

defineEmits<{
  (e: "startDownload", modelId: string): void;
}>();
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.welcome-step {
  gap: $spacing-md;
  padding: $spacing-lg;
}

.step-title {
  font-size: $font-lg;
  font-weight: $font-semibold;
}

.step-desc {
  font-size: $font-sm;
}

.model-list {
  gap: $spacing-sm;
}

.selected {
  border-color: var(--primary-color);
}

.model-size {
  font-size: $font-xs;
}

.download-progress {
  gap: $spacing-sm;
}

.progress-label {
  font-size: $font-xs;
  text-align: center;
}
</style>