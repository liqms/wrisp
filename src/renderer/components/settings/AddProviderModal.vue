<template>
  <n-modal :show="show" preset="card" content-scrollable
    :title="editingProvider ? t('SETTINGS.AI_SETTINGS.EDIT_PROVIDER') : t('SETTINGS.AI_SETTINGS.ADD_PROVIDER')"
    :style="{ maxWidth: '600px', width: '90%', maxHeight: '550px' }" :mask-closable="false"
    @update:show="$emit('update:show', $event)">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="top">
      <!-- 预设服务商选择（新增时显示） -->
      <n-form-item v-if="!editingProvider" :label="t('SETTINGS.AI_SETTINGS.PRESET_PROVIDER')">
        <n-select v-model:value="selectedPresetId" :placeholder="t('SETTINGS.AI_SETTINGS.SELECT_PROVIDER_HINT')"
          :options="presetOptions" clearable @update:value="onPresetChange" />
      </n-form-item>

      <n-form-item :label="t('SETTINGS.AI_SETTINGS.PROVIDER_NAME')" path="name" required>
        <n-input v-model:value="formData.name" :placeholder="t('SETTINGS.AI_SETTINGS.PROVIDER_NAME')" />
      </n-form-item>

      <n-form-item :label="t('SETTINGS.AI_SETTINGS.BASE_URL')" path="baseUrl">
        <n-input v-model:value="formData.baseUrl" placeholder="https://api.example.com" />
      </n-form-item>

      <n-form-item :label="t('SETTINGS.AI_SETTINGS.WEBSITE_URL')" path="websiteUrl">
        <n-input v-model:value="formData.websiteUrl" placeholder="https://example.com" />
      </n-form-item>

      <n-form-item :label="t('SETTINGS.AI_SETTINGS.API_KEY')" path="apiKey" required>
        <n-input v-model:value="formData.apiKey" type="password" show-password-on="click"
          :placeholder="t('SETTINGS.AI_SETTINGS.API_KEY_PLACEHOLDER')" />
      </n-form-item>

      <!-- 模型列表 -->
      <n-form-item v-if="formData.models.length > 0" :label="t('SETTINGS.AI_SETTINGS.MODELS')">
        <n-flex vertical class="model-list">
          <ModelItem v-for="model in formData.models" :key="model.id" :model="model" />
        </n-flex>
      </n-form-item>
    </n-form>

    <n-flex justify="end" class="step-actions">
      <n-button @click="$emit('update:show', false)">{{ t('ACTION.COMMON.CANCEL') }}</n-button>
      <n-button type="primary" @click="handleConfirm">
        {{ editingProvider ? t('ACTION.COMMON.SAVE') : t('ACTION.COMMON.CONFIRM') }}
      </n-button>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import type { FormInst } from "naive-ui";
import { PROVIDER } from "@/shared/enums";
import type { Locale } from "@/shared/enums";
import type { AIProvider, Model } from "@/shared/types";
import ModelItem from "./ModelItem.vue";

const { t } = useI18n();

const props = defineProps<{
  show: boolean;
  editingProvider?: AIProvider | null;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm", provider: AIProvider): void;
}>();

const formRef = ref<FormInst | null>(null);
const selectedPresetId = ref<string | null>(null);

const presetOptions = computed(() =>
  PROVIDER.map((p) => ({
    label: p.name,
    value: p.id,
  })),
);

const formData = ref<{
  id: string;
  name: string;
  baseUrl: string;
  websiteUrl: string;
  apiKey: string;
  locale: string;
  logoPath: string;
  models: Model[];
}>({
  id: "",
  name: "",
  baseUrl: "",
  websiteUrl: "",
  apiKey: "",
  locale: "",
  logoPath: "",
  models: [],
});

const rules = {
  name: [
    { required: true, message: t("SETTINGS.AI_SETTINGS.PROVIDER_NAME_REQUIRED"), trigger: "blur" },
  ],
  baseUrl: [
    { required: true, message: t("SETTINGS.AI_SETTINGS.BASE_URL_REQUIRED"), trigger: "blur" },
    { pattern: /^https?:\/\/.+/, message: t("SETTINGS.AI_SETTINGS.URL_INVALID"), trigger: "blur" },
  ],
  websiteUrl: [
    { pattern: /^https?:\/\/.+/, message: t("SETTINGS.AI_SETTINGS.URL_INVALID"), trigger: "blur" },
  ],
  apiKey: [
    { required: true, message: t("SETTINGS.AI_SETTINGS.API_KEY_REQUIRED"), trigger: "blur" },
  ],
};

function resetForm() {
  selectedPresetId.value = null;
  formData.value = {
    id: "",
    name: "",
    baseUrl: "",
    websiteUrl: "",
    apiKey: "",
    locale: "",
    logoPath: "",
    models: [],
  };
}

// 打开弹窗时：编辑模式预填，新增模式重置
watch(
  () => props.show,
  (val) => {
    if (!val) return;
    if (props.editingProvider) {
      // 编辑模式：用已有数据预填
      selectedPresetId.value = null;
      formData.value = {
        id: props.editingProvider.id,
        name: props.editingProvider.name,
        baseUrl: props.editingProvider.baseUrl,
        websiteUrl: props.editingProvider.websiteUrl ?? "",
        apiKey: props.editingProvider.apiKey ?? "",
        locale: props.editingProvider.locale,
        logoPath: props.editingProvider.logoPath ?? "",
        models: [...(props.editingProvider.models ?? [])],
      };
    } else {
      resetForm();
    }
  },
);

// 选择预设服务商后预填表单
function onPresetChange(presetId: string | null) {
  if (!presetId) return;
  const preset = PROVIDER.find((p) => p.id === presetId);
  if (!preset) return;

  formData.value = {
    id: preset.id,
    name: preset.name,
    baseUrl: preset.baseUrl,
    websiteUrl: preset.websiteUrl ?? "",
    apiKey: "",
    locale: preset.locale,
    logoPath: preset.logoPath ?? "",
    models: [...preset.models],
  };
}

async function handleConfirm() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const provider: AIProvider = {
    id: formData.value.id || formData.value.name,
    name: formData.value.name,
    baseUrl: formData.value.baseUrl,
    websiteUrl: formData.value.websiteUrl || undefined,
    apiKey: formData.value.apiKey,
    locale: formData.value.locale as Locale,
    logoPath: formData.value.logoPath || undefined,
    models: formData.value.models,
    enabled: props.editingProvider?.enabled ?? true,
  };

  try {
    emit("confirm", provider);
  } catch (e) {
    console.error("确认添加服务商失败", e);
  }
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/variables" as *;

.model-list {
  width: 100%;
  gap: $spacing-xs;
}

.step-actions {
  gap: $spacing-sm;
}
</style>