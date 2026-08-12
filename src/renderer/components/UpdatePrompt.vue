<template>
  <n-modal v-model:show="visible" preset="card" :title="t('UPDATE.TITLE')" :style="{ maxWidth: '420px' }">
    <n-flex vertical>
      <n-text>{{ t('UPDATE.DESCRIPTION', { version }) }}</n-text>
      <n-text depth="3" class="release-notes">{{ releaseNotes }}</n-text>
    </n-flex>
    <template #footer>
      <n-flex justify="end" align="center">
        <n-text v-if="downloading" depth="3">{{ t('UPDATE.DOWNLOADING', { percent }) }}</n-text>
        <template v-else>
          <n-button v-if="installed" type="primary" @click="handleInstall">{{ t('UPDATE.INSTALLING') }}</n-button>
          <template v-else>
            <n-button @click="handleSkip">{{ t('UPDATE.SKIP') }}</n-button>
            <n-button @click="handleLater">{{ t('UPDATE.LATER') }}</n-button>
            <n-button type="primary" @click="handleUpdate">{{ t('UPDATE.UPDATE_NOW') }}</n-button>
          </template>
        </template>
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
    downloading?: boolean;
    percent?: number;
    installed?: boolean;
  }>(),
  {
    visible: false,
    version: "0.0.0",
    releaseNotes: "",
    downloading: false,
    percent: 0,
    installed: false,
  },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "update"): void;
  (e: "later"): void;
  (e: "skip"): void;
  (e: "install"): void;
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

function handleInstall(): void {
  emit("install");
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