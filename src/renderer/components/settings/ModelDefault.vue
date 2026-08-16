<template>
  <n-card v-if="enableCloudAi && textModelsOptions.length > 0" size="medium" :bordered="false" class="setting-card">
    <n-flex class="setting-row">
      <n-flex align="center" class="setting-content">
        <n-text class="setting-label">{{
          t("SETTINGS.DEFAULT_MODEL")
        }}</n-text>
        <n-text class="setting-desc">{{ t("SETTINGS.DEFAULT_MODEL_DESC") }}</n-text>
      </n-flex>
      <n-select :value="defaultTextModel" :options="textModelsOptions" class="setting-select"
        :placeholder="t('SETTINGS.SELECT_MODEL')"
        @update:value="(v: string) => updateDefaultModel(OUTPUT_MODEL_TYPE.TEXT, v)" />
    </n-flex>
  </n-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useModel } from "@/renderer/composables/useModel";
import { OUTPUT_MODEL_TYPE } from "@/shared/enums";
import { computed } from "vue";

const { t } = useI18n();
const { providers, defaultModels, enableCloudAi, addOrUpdateDefaultModel } = useModel();

const defaultTextModel = computed(() => getDefaultForType(OUTPUT_MODEL_TYPE.TEXT));
const textModelsOptions = computed(() => getModelsForType(OUTPUT_MODEL_TYPE.TEXT));

const getModelsForType = (type: string) => {
  const models: { label: string; value: string }[] = [];
  for (const provider of providers.value) {
    if (!provider.enabled) continue;
    for (const model of provider.models) {
      if (model.outputType === type) {
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
  const dm = defaultModels.value.find((m) => m.outputType === type);
  return dm ? `${dm.providerId}:${dm.modelId}` : "";
};

const updateDefaultModel = async (type: string, value: string) => {
  const newDefaults = defaultModels.value.filter((m) => m.outputType !== type);
  if (value) {
    const [providerId, modelId] = value.split(":");
    newDefaults.push({ outputType: type, providerId, modelId });
  }
  await addOrUpdateDefaultModel(newDefaults);
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/variables.scss" as *;

.setting-row {
  margin-bottom: $spacing-md;
  align-items: center;
  min-height: 34px;
  justify-content: space-between !important;
  flex-direction: row !important;

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
  width: 130px;
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