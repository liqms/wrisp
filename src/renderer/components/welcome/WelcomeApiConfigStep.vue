<template>
  <n-flex vertical class="welcome-step">
    <n-text class="step-title">{{ t('WELCOME.API_CONFIG.TITLE') }}</n-text>
    <n-text depth="3" class="step-desc">{{ t('WELCOME.API_CONFIG.DESCRIPTION') }}</n-text>

    <n-form :model="formData" label-placement="top" class="config-form">
      <n-form-item :label="t('WELCOME.API_CONFIG.PROVIDER')" path="provider">
        <n-select
          v-model:value="formData.provider"
          :options="providerOptions"
          :placeholder="t('WELCOME.API_CONFIG.PROVIDER_PLACEHOLDER')"
        />
      </n-form-item>

      <n-form-item :label="t('WELCOME.API_CONFIG.API_KEY')" path="apiKey">
        <n-input
          v-model:value="formData.apiKey"
          :placeholder="t('WELCOME.API_CONFIG.API_KEY_PLACEHOLDER')"
          type="password"
          show-password-on="click"
        />
      </n-form-item>

      <n-form-item :label="t('WELCOME.API_CONFIG.API_URL')" path="apiUrl">
        <n-input
          v-model:value="formData.apiUrl"
          :placeholder="t('WELCOME.API_CONFIG.API_URL_PLACEHOLDER')"
        />
      </n-form-item>
    </n-form>

    <n-flex justify="end">
      <n-button @click="handleTest">{{ t('WELCOME.API_CONFIG.TEST') }}</n-button>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { NFlex, NText, NForm, NFormItem, NInput, NSelect, NButton } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { SelectOption } from "naive-ui";

const { t } = useI18n();

const formData = reactive({
  provider: "",
  apiKey: "",
  apiUrl: "",
});

const providerOptions: SelectOption[] = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Gemini", value: "gemini" },
  { label: t('WELCOME.API_CONFIG.CUSTOM'), value: "custom" },
];

const emit = defineEmits<{
  (e: "test", config: { provider: string; apiKey: string; apiUrl: string }): void;
  (e: "save", config: { provider: string; apiKey: string; apiUrl: string }): void;
}>();

function handleTest(): void {
  emit("test", { ...formData });
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

.config-form {
  width: 100%;
}
</style>