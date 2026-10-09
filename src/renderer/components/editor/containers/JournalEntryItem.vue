<template>
  <div class="journal-entry-item" :class="{ editing }">
    <div class="entry-meta">
      <span class="entry-time">{{ displayTime }}</span>
      <n-tag size="small" :bordered="false" type="default">
        {{ t(`TIPS.JOURNAL.ENTRY_SOURCE.${entry.source.toUpperCase()}`) }}
      </n-tag>
      <n-tag v-for="tag in entry.tags" :key="tag.id" size="tiny" :bordered="false">#{{ tag.name }}</n-tag>
      <n-tag v-for="p in entry.projects" :key="p.id" size="tiny" :bordered="false" type="info">&{{ p.name }}</n-tag>
    </div>
    <template v-if="!editing">
      <div class="entry-content" @dblclick="startEdit" v-html="renderedContent"></div>
      <div class="entry-toolbar">
        <n-button text size="tiny" @click="startEdit">{{ t("ACTION.COMMON.EDIT") }}</n-button>
        <n-button text size="tiny" type="error" @click="confirmDelete">{{ t("TIPS.JOURNAL.ENTRY_DELETE") }}</n-button>
      </div>
    </template>
    <template v-else>
      <n-input
        v-model:value="draft"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 12 }"
        :placeholder="t('TIPS.JOURNAL.ENTRY_EDIT_PLACEHOLDER')"
      />
      <n-flex justify="end" class="edit-actions">
        <n-button size="tiny" quaternary @click="cancelEdit">{{ t("TIPS.JOURNAL.ENTRY_CANCEL") }}</n-button>
        <n-button size="tiny" type="primary" :disabled="draft.trim() === ''" @click="saveEdit">{{ t("TIPS.JOURNAL.ENTRY_SAVE") }}</n-button>
      </n-flex>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDialog } from "naive-ui";
import { marked } from "marked";
import type { JournalEntryView } from "@/shared/types";
import { TimeUtil } from "@/shared/utils";
import { sanitizeHtml } from "@/renderer/utils/sanitize";
import { useJournal } from "@/renderer/composables/useJournal";

const props = defineProps<{ entry: JournalEntryView }>();

const { t } = useI18n();
const dialog = useDialog();
const { updateEntry, requestDeleteEntry } = useJournal();

const editing = ref(false);
const draft = ref("");
const displayTime = computed(() => TimeUtil.format(props.entry.occurred_at, "HH:mm"));

// 只读正文复用既有 markdown 渲染链路：marked 同步解析 → sanitizeHtml 白名单清洗
// （v-html 必须过 sanitize，见 AGENTS.md pitfall #15；同步形式先例 slash/commands/helpers.ts）
const renderedContent = computed(() =>
  sanitizeHtml(marked.parse(props.entry.content) as string),
);

function startEdit() {
  draft.value = props.entry.content;
  editing.value = true;
}
function cancelEdit() {
  editing.value = false;
}
async function saveEdit() {
  const ok = await updateEntry({ id: props.entry.id, content: draft.value });
  if (ok) editing.value = false;
}
function confirmDelete() {
  dialog.warning({
    title: t("TIPS.JOURNAL.ENTRY_DELETE"),
    content: t("TIPS.JOURNAL.ENTRY_DELETE_CONFIRM"),
    positiveText: t("ACTION.COMMON.CONFIRM"),
    negativeText: t("ACTION.COMMON.CANCEL"),
    onPositiveClick: () => void requestDeleteEntry(props.entry.id),
  });
}
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.journal-entry-item {
  padding: $spacing-sm 0;

  &.editing {
    padding: $spacing-sm 0;
  }
}

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;
}

.entry-time {
  font-size: $font-xs;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.entry-content {
  font-size: $font-base;
  line-height: 1.6;
  cursor: text;
}

.entry-toolbar {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-xs;
  opacity: 0;
  transition: opacity $transition-base;
}

.journal-entry-item:hover .entry-toolbar {
  opacity: 1;
}

.edit-actions {
  margin-top: $spacing-xs;
}
</style>
