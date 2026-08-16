<template>
  <n-flex v-if="visible" class="quick-actions">
    <n-button quaternary size="tiny" @click="handleContinue">
      <template #icon>
        <n-icon><SparklesOutline /></n-icon>
      </template>
      {{ t('EDITOR.QUICK_ACTIONS.CONTINUE') }}
    </n-button>
    <n-button quaternary size="tiny" @click="handlePolish">
      <template #icon>
        <n-icon><ColorWandOutline /></n-icon>
      </template>
      {{ t('EDITOR.QUICK_ACTIONS.POLISH') }}
    </n-button>
    <n-button quaternary size="tiny" @click="handleSummarize">
      <template #icon>
        <n-icon><DocumentTextOutline /></n-icon>
      </template>
      {{ t('EDITOR.QUICK_ACTIONS.SUMMARIZE') }}
    </n-button>
  </n-flex>
</template>

<script setup lang="ts">
import { NFlex, NButton, NIcon } from "naive-ui";
import { SparklesOutline, ColorWandOutline, DocumentTextOutline } from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

withDefaults(
  defineProps<{
    visible?: boolean;
  }>(),
  {
    visible: false,
  },
);

const emit = defineEmits<{
  (e: "continue"): void;
  (e: "polish"): void;
  (e: "summarize"): void;
}>();

function handleContinue(): void {
  emit("continue");
}

function handlePolish(): void {
  emit("polish");
}

function handleSummarize(): void {
  emit("summarize");
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.quick-actions {
  gap: $spacing-xs;
  padding: $spacing-xs;
  background-color: var(--bg-secondary);
  border-radius: $radius-md;
  border: 1px solid var(--border-color);
}
</style>