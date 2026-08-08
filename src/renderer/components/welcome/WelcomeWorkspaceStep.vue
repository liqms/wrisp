<template>
  <n-flex vertical class="welcome-step">
    <n-text class="step-title">{{ t('WELCOME.WORKSPACE.TITLE') }}</n-text>
    <n-text depth="3" class="step-desc">{{ t('WELCOME.WORKSPACE.DESCRIPTION') }}</n-text>

    <n-input-group class="path-input">
      <n-input
        v-model:value="workspacePath"
        :placeholder="t('WELCOME.WORKSPACE.PLACEHOLDER')"
        readonly
        @click="handleBrowse"
      />
      <n-button @click="handleBrowse" type="primary">
        {{ t('WELCOME.WORKSPACE.BROWSE') }}
      </n-button>
    </n-input-group>
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NFlex, NText, NInput, NInputGroup, NButton } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const workspacePath = ref("");

const emit = defineEmits<{
  (e: "select", path: string): void;
}>();

function handleBrowse(): void {
  // 占位：打开文件夹选择对话框
  emit("select", workspacePath.value);
}
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

.path-input {
  width: 100%;
}
</style>