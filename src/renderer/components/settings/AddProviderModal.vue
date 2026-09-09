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

      <!-- 获取模型列表 -->
      <n-form-item :label="t('SETTINGS.AI_SETTINGS.MODELS')">
        <n-flex align="center" class="fetch-row">
          <n-button type="primary" size="small" :loading="fetching" :disabled="!canFetch" @click="handleFetchModels">
            {{ t('SETTINGS.AI_SETTINGS.FETCH_MODELS') }}
          </n-button>
          <n-text v-if="fetchHint" class="fetch-hint" depth="3">{{ fetchHint }}</n-text>
        </n-flex>
      </n-form-item>

      <!-- 模型列表（可勾选） -->
      <n-form-item v-if="availableModels.length > 0" :label="t('SETTINGS.AI_SETTINGS.SELECT_MODELS_HINT')">
        <n-flex vertical class="model-list">
          <ModelItem v-for="model in availableModels" :key="model.id" :model="model" selectable
            :checked="selectedModelIds.has(model.id)" @toggle="(val) => handleToggleModel(model.id, val)" />
        </n-flex>
        <n-flex class="select-all-row">
          <n-checkbox :checked="allSelected" @update:checked="handleSelectAll">
            {{ t('ACTION.COMMON.SELECT_ALL') }}
          </n-checkbox>
        </n-flex>
      </n-form-item>

      <!-- 错误提示 -->
      <n-alert v-if="fetchError" type="error" :show-icon="true" class="fetch-error">
        {{ fetchError }}
      </n-alert>
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
import { logger } from "@/renderer/utils/logger.utils";
import { getErrorMessage } from "@/renderer/utils/error.utils";

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

// 拉取模型相关状态
const fetching = ref(false);
const fetchError = ref<string | null>(null);
const availableModels = ref<Model[]>([]);
const selectedModelIds = ref<Set<string>>(new Set());

const presetOptions = computed(() =>
  PROVIDER.map((p) => ({
    label: p.name,
    value: p.id,
  })),
);

const canFetch = computed(() => !!formData.value.apiKey && !!formData.value.baseUrl && !!formData.value.id);

const fetchHint = computed(() => {
  if (fetching.value) return t("SETTINGS.AI_SETTINGS.FETCH_MODELS_LOADING");
  if (!formData.value.apiKey || !formData.value.baseUrl) return t("SETTINGS.AI_SETTINGS.FETCH_MODELS_HINT");
  return null;
});

const allSelected = computed(() =>
  availableModels.value.length > 0 && availableModels.value.every((m) => selectedModelIds.value.has(m.id)),
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
  fetchError.value = null;
  availableModels.value = [];
  selectedModelIds.value = new Set();
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
      // 编辑模式：预填已有模型并全选
      availableModels.value = [...(props.editingProvider.models ?? [])];
      selectedModelIds.value = new Set(availableModels.value.map((m) => m.id));
      fetchError.value = null;
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
    models: [],
  };
  // 切换预设后清空已拉取的模型
  availableModels.value = [];
  selectedModelIds.value = new Set();
  fetchError.value = null;
}

// 从厂商接口拉取模型列表
async function handleFetchModels() {
  if (!canFetch.value) return;
  fetching.value = true;
  fetchError.value = null;
  try {
    const res = await window.electronAPI.ai.listModels(formData.value.id);
    if (res.success && Array.isArray(res.data)) {
      const models = res.data as Model[];
      availableModels.value = models;
      // 默认全选
      selectedModelIds.value = new Set(models.map((m) => m.id));
      if (models.length === 0) {
        fetchError.value = t("SETTINGS.AI_SETTINGS.FETCH_MODELS_EMPTY");
      }
    } else {
      fetchError.value = t("SETTINGS.AI_SETTINGS.FETCH_MODELS_FAILED", { msg: getErrorMessage(res.code) });
    }
  } catch (e) {
    logger.error("获取模型列表失败", { error: e });
    fetchError.value = t("SETTINGS.AI_SETTINGS.FETCH_MODELS_FAILED", { msg: String(e) });
  } finally {
    fetching.value = false;
  }
}

function handleToggleModel(modelId: string, checked: boolean) {
  const next = new Set(selectedModelIds.value);
  if (checked) {
    next.add(modelId);
  } else {
    next.delete(modelId);
  }
  selectedModelIds.value = next;
}

function handleSelectAll(checked: boolean) {
  if (checked) {
    selectedModelIds.value = new Set(availableModels.value.map((m) => m.id));
  } else {
    selectedModelIds.value = new Set();
  }
}

async function handleConfirm() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  // 保存时使用勾选的模型；若未拉取过则保留 formData.models（编辑模式原模型）
  const finalModels = availableModels.value.length > 0
    ? availableModels.value.filter((m) => selectedModelIds.value.has(m.id))
    : formData.value.models;

  const provider: AIProvider = {
    id: formData.value.id || formData.value.name,
    name: formData.value.name,
    baseUrl: formData.value.baseUrl,
    websiteUrl: formData.value.websiteUrl || undefined,
    apiKey: formData.value.apiKey,
    locale: formData.value.locale as Locale,
    logoPath: formData.value.logoPath || undefined,
    models: finalModels,
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

.fetch-row {
  gap: $spacing-sm;
}

.fetch-hint {
  font-size: $font-xs;
}

.model-list {
  width: 100%;
  gap: $spacing-xs;
}

.select-all-row {
  margin-top: $spacing-sm;
}

.fetch-error {
  margin-top: $spacing-sm;
}

.step-actions {
  gap: $spacing-sm;
}
</style>
