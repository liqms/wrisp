<template>
  <n-modal v-model:show="visible" preset="card" :title="t('UPDATE.TITLE')" :style="{ maxWidth: '420px' }">
    <n-flex vertical>
      <n-text>{{ t('UPDATE.DESCRIPTION', { version }) }}</n-text>
      <!-- releaseNotesHtml 已通过 sanitizeHtml 清洗，此处渲染是安全的 -->
      <div class="release-notes markdown-content" v-html="releaseNotesHtml"></div>
    </n-flex>
    <template #footer>
      <n-flex justify="end" align="center">
        <n-text v-if="downloading" depth="3">{{ t('UPDATE.DOWNLOADING', { percent }) }}</n-text>
        <template v-else>
          <n-button v-if="installed" type="primary" @click="handleInstall">{{ t('UPDATE.INSTALLING') }}</n-button>
          <template v-else>
            <n-button @click="handleLater">{{ t('UPDATE.LATER') }}</n-button>
            <n-button type="primary" @click="handleUpdate">{{ t('UPDATE.UPDATE_NOW') }}</n-button>
          </template>
        </template>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NModal, NFlex, NText, NButton } from "naive-ui";
import { useI18n } from "vue-i18n";
import { marked } from "marked";
import { sanitizeHtml } from "@/renderer/utils/sanitize";

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
  (e: "install"): void;
}>();

const visible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

/** GitHub Release 描述为 Markdown，渲染为富文本 HTML（渲染前清洗防 XSS） */
const releaseNotesHtml = ref("");
watch(
  () => props.releaseNotes,
  async (md) => {
    releaseNotesHtml.value = md
      ? sanitizeHtml(await marked.parse(md, { async: true }))
      : "";
  },
  { immediate: true },
);

function handleUpdate(): void {
  emit("update");
}

function handleLater(): void {
  emit("later");
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
  color: var(--text-secondary);
  max-height: 200px;
  overflow-y: auto;
}
</style>