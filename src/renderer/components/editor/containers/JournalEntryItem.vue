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
import { useFrontendNotification } from "@/renderer/composables/useNotification";

const props = defineProps<{ entry: JournalEntryView }>();

const { t } = useI18n();
const dialog = useDialog();
// options 为 useFrontendNotification 的必填形参（内部不使用），文案在每次调用时显式传入
const notify = useFrontendNotification({ title: "", content: "" });
const { updateEntry, requestDeleteEntry, hasError, errorMessage, clearError } = useJournal();

const editing = ref(false);
const draft = ref("");
const displayTime = computed(() => TimeUtil.format(props.entry.occurred_at, "HH:mm"));

// 只读正文复用既有 markdown 渲染链路：marked 同步解析 → sanitizeHtml 白名单清洗
// （v-html 必须过 sanitize，见 AGENTS.md pitfall #15；同步形式先例 slash/commands/helpers.ts）
// breaks: true —— 条目正文是纯文本录入，单换行即用户意图的换行（marked 默认会吞掉）
const renderedContent = computed(() =>
  sanitizeHtml(marked.parse(props.entry.content, { breaks: true }) as string),
);

function startEdit() {
  draft.value = props.entry.content;
  editing.value = true;
}
function cancelEdit() {
  editing.value = false;
}
/**
 * 动作失败提示。判据只能是 hasError（store.errorCode !== null），不能用动作返回值：
 * updateEntry / requestDeleteEntry 返回 false 有两种含义 ——
 * 1) success:true + data:false ⇒ 条目已被并发删除，store 走 deleteEntryLocal 本地自愈且
 *    故意不写 errorCode（journal.store.ts 契约），此时弹「失败」是在对用户撒谎；
 * 2) success:false 或 IPC reject ⇒ 真失败，errorCode 已写。
 * errorMessage 已由 handleApiError 按 ErrorCode 本地化，直接作正文，不再造 _CONTENT 文案。
 */
function reportFailure(titleKey: string) {
  const content = errorMessage.value; // 取局部量只为满足 string | null 收窄，两者在 store 里成对写入
  if (hasError.value && content) {
    notify.error(t(titleKey), content);
    clearError();
  }
}

async function saveEdit() {
  const ok = await updateEntry({ id: props.entry.id, content: draft.value });
  if (ok) editing.value = false;
  reportFailure("TIPS.JOURNAL.ENTRY_UPDATE_FAILED");
}
function confirmDelete() {
  dialog.warning({
    title: t("TIPS.JOURNAL.ENTRY_DELETE"),
    content: t("TIPS.JOURNAL.ENTRY_DELETE_CONFIRM"),
    positiveText: t("ACTION.COMMON.CONFIRM"),
    negativeText: t("ACTION.COMMON.CANCEL"),
    // 提示与 dialog 关闭互不干涉：不返回 false（沿用「点击即关」体验），失败提示由 reportFailure 兜底
    onPositiveClick: async () => {
      await requestDeleteEntry(props.entry.id);
      reportFailure("TIPS.JOURNAL.ENTRY_DELETE_FAILED");
    },
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
