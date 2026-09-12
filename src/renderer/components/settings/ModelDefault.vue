<template>
  <n-card v-if="enableCloudAi && textModelsOptions.length > 0" size="medium" :bordered="false" class="setting-card">
    <n-flex vertical class="setting-list">
      <!-- 通用默认模型（outputType 兜底） -->
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.DEFAULT_MODEL") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.DEFAULT_MODEL_DESC") }}</n-text>
        </n-flex>
        <n-select :value="getDefaultValue()" :options="textModelsOptions" class="setting-select" clearable
          :placeholder="t('SETTINGS.AI_SETTINGS.SELECT_MODEL')"
          @update:value="(v: string | null) => updateGeneralDefault(v)" />
      </n-flex>

      <!-- 按创作类型配置默认模型 -->
      <n-flex v-for="task in taskTypes" :key="task" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t(`SETTINGS.TASK_TYPE.${task}`) }}</n-text>
          <n-text class="setting-desc">{{ t(`SETTINGS.TASK_TYPE.${task}_DESC`) }}</n-text>
        </n-flex>
        <n-select :value="getDefaultValue(task)" :options="textModelsOptions" class="setting-select" clearable
          :placeholder="t('SETTINGS.AI_SETTINGS.SELECT_MODEL')"
          @update:value="(v: string | null) => updateTaskDefault(task, v)" />
      </n-flex>
    </n-flex>
  </n-card>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useModel } from "@/renderer/composables/useModel";
import { OUTPUT_MODEL_TYPE, TASK_TYPE } from "@/shared/enums";
import type { TaskType } from "@/shared/enums";
import { computed } from "vue";

const { t } = useI18n();
const { providers, defaultModels, enableCloudAi, addOrUpdateDefaultModel } = useModel();

const taskTypes = Object.values(TASK_TYPE) as TaskType[];

const textModelsOptions = computed(() => {
  const models: { label: string; value: string }[] = [];
  for (const provider of providers.value) {
    if (!provider.enabled) continue;
    for (const model of provider.models) {
      if (model.outputType === OUTPUT_MODEL_TYPE.TEXT) {
        models.push({
          label: `${provider.name} / ${model.name}`,
          value: `${provider.id}:${model.id}`,
        });
      }
    }
  }
  return models;
});

/** 取指定 taskType（或通用）的当前默认模型值，格式 providerId:modelId */
const getDefaultValue = (taskType?: TaskType): string | null => {
  const dm = defaultModels.value.find((m) =>
    taskType ? m.taskType === taskType : m.outputType === OUTPUT_MODEL_TYPE.TEXT && m.taskType === undefined,
  );
  return dm ? `${dm.providerId}:${dm.modelId}` : null;
};

/** 更新通用默认模型（outputType=text，无 taskType） */
const updateGeneralDefault = async (value: string | null) => {
  const newDefaults = defaultModels.value.filter(
    (m) => !(m.outputType === OUTPUT_MODEL_TYPE.TEXT && m.taskType === undefined),
  );
  if (value) {
    const [providerId, modelId] = value.split(":");
    newDefaults.push({ outputType: OUTPUT_MODEL_TYPE.TEXT, providerId, modelId });
  }
  await addOrUpdateDefaultModel(newDefaults);
};

/** 更新指定创作类型的默认模型 */
const updateTaskDefault = async (taskType: TaskType, value: string | null) => {
  const newDefaults = defaultModels.value.filter((m) => m.taskType !== taskType);
  if (value) {
    const [providerId, modelId] = value.split(":");
    newDefaults.push({ outputType: OUTPUT_MODEL_TYPE.TEXT, providerId, modelId, taskType });
  }
  await addOrUpdateDefaultModel(newDefaults);
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/variables.scss" as *;

.setting-list {
  gap: $spacing-md;
}

.setting-row {
  align-items: center;
  min-height: 34px;
  justify-content: space-between !important;
  flex-direction: row !important;
}

.setting-content {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 0 !important;
  max-width: calc(100% - 280px);
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
