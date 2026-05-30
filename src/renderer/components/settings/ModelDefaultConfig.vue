<template>
  <n-card size="small" :title="t('SETTINGS.DEFAULT_MODEL_CONFIG')">
    <n-flex vertical class="config-list">
      <n-flex v-for="mt in modelTypes" :key="mt.key" align="center" class="setting-row">
        <n-text class="setting-label">{{ mt.label() }}</n-text>
        <n-select
          :value="getDefaultForType(mt.key)"
          :options="getModelsForType(mt.key)"
          class="setting-select"
          @update:value="(v) => updateDefaultModel(mt.key, v)"
        />
      </n-flex>
    </n-flex>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConfig } from "@/renderer/composables/useConfig";
import { MODEL_TYPE } from "@/shared/enums";
import type { AppConfig, AIProvider, DefaultModel } from "@/shared/types";

const props = defineProps<{ config: AppConfig | null }>();
const { t } = useI18n();
const configStore = useConfig();

const modelTypes = [
  { key: MODEL_TYPE.TEXT, label: () => t("SETTINGS.MODEL_TYPE_LABELS.TEXT") },
  { key: MODEL_TYPE.IMAGE, label: () => t("SETTINGS.MODEL_TYPE_LABELS.IMAGE") },
  { key: MODEL_TYPE.AUDIO, label: () => t("SETTINGS.MODEL_TYPE_LABELS.AUDIO") },
  { key: MODEL_TYPE.VIDEO, label: () => t("SETTINGS.MODEL_TYPE_LABELS.VIDEO") },
];

const providers = computed<AIProvider[]>(() => props.config?.aiProviders ?? []);
const defaultModels = computed<DefaultModel[]>(() => props.config?.defaultModels ?? []);

const getModelsForType = (type: string) => {
  const models: { label: string; value: string }[] = [{ label: "None", value: "" }];
  for (const provider of providers.value) {
    for (const model of provider.models) {
      if (model.type.includes(type)) {
        models.push({
          label: `${provider.name} / ${model.name}`,
          value: `${provider.id}:${model.id}`,
        });
      }
    }
  }
  return models;
};

const getDefaultForType = (type: string) => {
  const dm = defaultModels.value.find((m) => m.type === type);
  return dm ? `${dm.providerId}:${dm.modelId}` : "";
};

const updateDefaultModel = async (type: string, value: string) => {
  const newDefaults = [...defaultModels.value.filter((m) => m.type !== type)];
  if (value) {
    const [providerId, modelId] = value.split(":");
    newDefaults.push({ type, providerId, modelId });
  }
  await configStore.setValue("defaultModels", newDefaults);
};
</script>

<style scoped lang="scss">
.config-list {
  gap: 4px;
}

.setting-row {
  margin-bottom: 10px;
  align-items: center;
}

.setting-label {
  width: 80px;
}

.setting-select {
  width: 280px;
}
</style>