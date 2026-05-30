<template>
  <n-scrollbar class="model-settings">
    <n-card size="small">
      <n-flex class="setting-row">
        <n-text class="setting-label">{{
          t("SETTINGS.AI_SETTINGS.AI_MODE")
        }}</n-text>
        <n-flex class="ai-mode-list">
          <AIModeCard
            v-for="mode in aiModeList"
            :key="mode.value"
            :label="mode.label"
            :description="mode.description"
            :tip="mode.tip"
            :value="mode.value"
            :selected="mode.value === currentAiMode.value"
            @click="handleAiModeClick(mode.value)"
          />
        </n-flex>
      </n-flex>
      <n-flex
        vertical
        class="config-list"
        v-if="currentAiMode.value === AI_MODE.PRO"
      >
        <n-flex
          v-for="mt in modelTypes"
          :key="mt.key"
          align="center"
          class="setting-row"
        >
          <n-text class="setting-label">{{ mt.label() }}</n-text>
          <n-select
            :value="getDefaultForType(mt.key)"
            :options="getModelsForType(mt.key)"
            class="setting-select"
            @update:value="(v: string) => updateDefaultModel(mt.key, v)"
          />
        </n-flex>
      </n-flex>
    </n-card>
    <n-card size="small" :title="t('SETTINGS.PROVIDER_MODELS')">
      <n-list v-if="providers.length > 0">
        <n-list-item v-for="provider in providers" :key="provider.id">
          <n-thing :title="provider.name">
            <template #description
              >{{ provider.models.length }} models</template
            >
          </n-thing>
        </n-list-item>
      </n-list>
      <n-empty v-else :description="t('TIPS.SEARCH.NO_CREATION')" />
    </n-card>
  </n-scrollbar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConfig } from "@/renderer/composables/useConfig";
import { MODEL_TYPE, AI_MODE, type AiMode } from "@/shared/enums";
import type { AppConfig, AIProvider, DefaultModel } from "@/shared/types";
import AIModeCard from "@/renderer/components/base/AIModeCard.vue";

const props = defineProps<{ config: AppConfig | null }>();
const { t } = useI18n();
const config = useConfig();

const currentAiMode = computed(() => config.aiMode ?? AI_MODE.BASE);

const aiModeList = computed(() => [
  {
    value: AI_MODE.BASE,
    label: t("SETTINGS.AI_SETTINGS.AI_MODE_BASE"),
    description: t("SETTINGS.AI_SETTINGS.AI_MODE_BASE_DESC"),
    tip: t("SETTINGS.AI_SETTINGS.AI_MODE_BASE_TIP"),
  },
  {
    value: AI_MODE.CORE,
    label: t("SETTINGS.AI_SETTINGS.AI_MODE_CORE"),
    description: t("SETTINGS.AI_SETTINGS.AI_MODE_CORE_DESC"),
    tip: t("SETTINGS.AI_SETTINGS.AI_MODE_CORE_TIP"),
  },
  {
    value: AI_MODE.PRO,
    label: t("SETTINGS.AI_SETTINGS.AI_MODE_PRO"),
    description: t("SETTINGS.AI_SETTINGS.AI_MODE_PRO_DESC"),
    tip: t("SETTINGS.AI_SETTINGS.AI_MODE_PRO_TIP"),
  },
]);

const handleAiModeClick = async (value: AiMode) => {
  if (value !== currentAiMode.value.value) {
    await config.updateAiMode(value);
  }
};

const modelTypes = computed(() => [
  { key: MODEL_TYPE.TEXT, label: () => t("SETTINGS.MODEL_TYPE_LABELS.TEXT") },
  // { key: MODEL_TYPE.IMAGE, label: () => t("SETTINGS.MODEL_TYPE_LABELS.IMAGE") },
  // { key: MODEL_TYPE.AUDIO, label: () => t("SETTINGS.MODEL_TYPE_LABELS.AUDIO") },
  // { key: MODEL_TYPE.VIDEO, label: () => t("SETTINGS.MODEL_TYPE_LABELS.VIDEO") },
]);

const providers = computed<AIProvider[]>(() => props.config?.aiProviders ?? []);
const defaultModels = computed<DefaultModel[]>(
  () => props.config?.defaultModels ?? [],
);

const getModelsForType = (type: string) => {
  const models: { label: string; value: string }[] = [
    { label: t("APP.BASE.NONE"), value: "" },
  ];
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
  await config.setValue("defaultModels", newDefaults);
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/variables.scss" as *;

.model-settings {
  max-height: 100%;
}

.n-card {
  margin-bottom: 12px;
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
  &:last-child {
    margin-bottom: 0;
  }
}

.setting-label {
  width: 130px;
}

.setting-select {
  width: 280px;
}
</style>
