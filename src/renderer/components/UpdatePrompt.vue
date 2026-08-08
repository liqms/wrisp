<template>
  <n-modal v-model:show="visible" preset="card" :title="t('UPDATE.TITLE')" :style="{ maxWidth: '420px' }">
    <n-flex vertical>
      <n-text>{{ t('UPDATE.DESCRIPTION', { version }) }}</n-text>
      <n-text depth="3" class="release-notes">{{ releaseNotes }}</n-text>
    </n-flex>
    <template #footer>
      <n-flex justify="end">
        <n-button @click="handleSkip">{{ t('UPDATE.SKIP') }}</n-button>
        <n-button @click="handleLater">{{ t('UPDATE.LATER') }}</n-button>
        <n-button type="primary" @click="handleUpdate">{{ t('UPDATE.UPDATE_NOW') }}</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NModal, NFlex, NText, NButton } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    version?: string;
    releaseNotes?: string;
  }>(),
  {
    visible: false,
    version: "0.0.0",
    releaseNotes: "",
  },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "update"): void;
  (e: "later"): void;
  (e: "skip"): void;
}>();

const visible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

function handleUpdate(): void {
  emit("update");
}

function handleLater(): void {
  emit("later");
}

function handleSkip(): void {
  emit("skip");
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.release-notes {
  margin-top: $spacing-sm;
  font-size: $font-xs;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}
</style>