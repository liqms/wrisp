<template>
  <n-flex vertical class="data-management">
    <n-text class="section-title">{{ t('SETTINGS.DATA_MANAGEMENT.TITLE') }}</n-text>
    <n-text depth="3" class="section-desc">{{ t('SETTINGS.DATA_MANAGEMENT.DESCRIPTION') }}</n-text>

    <n-divider />

    <n-flex vertical class="action-group">
      <!-- 导出数据 -->
      <n-flex align="center" justify="space-between">
        <n-flex vertical>
          <n-text>{{ t('SETTINGS.DATA_MANAGEMENT.EXPORT') }}</n-text>
          <n-text depth="3" class="action-desc">{{ t('SETTINGS.DATA_MANAGEMENT.EXPORT_DESC') }}</n-text>
        </n-flex>
        <n-button secondary @click="handleExport">{{ t('SETTINGS.DATA_MANAGEMENT.EXPORT_BTN') }}</n-button>
      </n-flex>

      <!-- 导入数据 -->
      <n-flex align="center" justify="space-between">
        <n-flex vertical>
          <n-text>{{ t('SETTINGS.DATA_MANAGEMENT.IMPORT') }}</n-text>
          <n-text depth="3" class="action-desc">{{ t('SETTINGS.DATA_MANAGEMENT.IMPORT_DESC') }}</n-text>
        </n-flex>
        <n-button secondary @click="handleImport">{{ t('SETTINGS.DATA_MANAGEMENT.IMPORT_BTN') }}</n-button>
      </n-flex>

      <!-- 清除数据 -->
      <n-flex align="center" justify="space-between">
        <n-flex vertical>
          <n-text>{{ t('SETTINGS.DATA_MANAGEMENT.CLEAR') }}</n-text>
          <n-text depth="3" class="action-desc">{{ t('SETTINGS.DATA_MANAGEMENT.CLEAR_DESC') }}</n-text>
        </n-flex>
        <n-button type="warning" secondary @click="handleClear">
          {{ t('SETTINGS.DATA_MANAGEMENT.CLEAR_BTN') }}
        </n-button>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { NFlex, NText, NDivider, NButton } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const emit = defineEmits<{
  (e: "export"): void;
  (e: "import"): void;
  (e: "clear"): void;
}>();

function handleExport(): void {
  emit("export");
}

function handleImport(): void {
  emit("import");
}

function handleClear(): void {
  emit("clear");
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.data-management {
  gap: $spacing-sm;
}

.section-title {
  font-size: $font-md;
  font-weight: $font-semibold;
}

.section-desc {
  font-size: $font-xs;
}

.action-group {
  gap: $spacing-md;
}

.action-desc {
  font-size: $font-xs;
}
</style>