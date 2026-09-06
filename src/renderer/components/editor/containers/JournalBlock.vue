<template>
  <n-flex class="journal-block" :class="{ 'is-today': isToday }" vertical>
    <!-- 日期标题行 -->
    <n-flex class="date-header" align="center" justify="space-between">
      <n-text class="date-title" depth="secondary">
        {{ displayDate }}
      </n-text>
    </n-flex>

    <!-- 编辑器 -->
    <TiptapEditor ref="editorRef" v-model:model-value="editContent" :min-height="editorMinHeight"
      :max-height="editorMaxHeight" :slash-command="true" :enable-bubble-menu="false" class="journal-editor"
      @enter="saveEdit" />

  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import TiptapEditor from "../TiptapEditor.vue";
import type { JournalFileInfo } from "@/shared/types";
import { useJournal } from "@/renderer/composables/useJournal";
import { useConfig } from "@/renderer/composables/useConfig";
import { TimeUtil } from "@/shared/utils";

const props = defineProps<{
  journal: JournalFileInfo;
}>();

const emit = defineEmits<{
  (e: "updated", journalId: string): void;
  (e: "deleted", journalId: string): void;
}>();

const { updateJournal, updateContentLocally } = useJournal();
const { journalDateFormat } = useConfig();

const editContent = ref(props.journal.content);
const lastSavedContent = ref(props.journal.content);
const editorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);

const todayStr = TimeUtil.getLocalDateString();
const isToday = computed(() => props.journal.date === todayStr);
const editorMinHeight = computed(() => (isToday.value ? 300 : 200));
/** 最大高度接近无上限，让日志块随内容自适应伸展，由外层滚动条负责整页滚动 */
const editorMaxHeight = 10000;

/**
 * 按配置的日期格式显示日期标题
 * journal.date 为 YYYY-MM-DD 字符串，拆分为本地时间构造 Date，避免 ISO 字符串按 UTC 解析产生时区偏移
 */
const displayDate = computed(() => {
  const dateStr = props.journal.date || "";
  const parts = dateStr.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    return dateStr;
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return TimeUtil.format(date, journalDateFormat.value || "yyyy-MM-dd");
});

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncingFromProp = false;

// 当外部 prop 更新时同步编辑器内容
watch(
  () => props.journal.content,
  (newContent) => {
    // 值与当前编辑内容一致：是自身保存（updateContentLocally 乐观更新）引发的 store 回写，
    // 仅刷新 lastSavedContent。若在此置 isSyncingFromProp 会武装一次性标记，
    // 吞掉下一次仅触发单次 emit 的编辑（如只切换代码块语言），导致该改动不保存。
    if (newContent === editContent.value) {
      lastSavedContent.value = newContent;
      return;
    }
    // 真正的外部变更：同步编辑器并跳过接下来的一次自动保存，
    // 避免 setContent 完成前防抖把旧内容写回覆盖新内容
    isSyncingFromProp = true;
    editContent.value = newContent;
    lastSavedContent.value = newContent;
  },
);

/** 静默后台保存 */
const saveEdit = async () => {
  const md = editorRef.value?.getMarkdown();
  if (md === undefined || md === null) return;
  if (md === lastSavedContent.value) return;
  lastSavedContent.value = md;
  // 立即更新 store（乐观更新），其他组件即时响应
  updateContentLocally(props.journal.id, md);
  emit("updated", props.journal.id);
  // 静默保存到磁盘，不关心结果
  updateJournal({
    id: props.journal.id,
    date: props.journal.date,
    content: md,
  });
};

// 内容变化后防抖 800ms 自动保存
watch(editContent, () => {
  if (isSyncingFromProp) {
    isSyncingFromProp = false;
    return;
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = setTimeout(() => {
    saveEdit();
  }, 800);
});

// 卸载前冲销未完成的防抖保存，避免切换视图时丢失最后 800ms 内的改动（与 PageBlock 行为一致）
onBeforeUnmount(() => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    void saveEdit();
  }
});
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.journal-block {
  padding: $spacing-md;
  border-radius: $radius-md;
  transition: background $transition-base;

  &.is-today {
    min-height: 500px;
  }
}

.date-header {
  margin-bottom: $spacing-sm;
  // 左右内边距与正文 ProseMirror 一致，日期标题与正文左对齐（见下方 .journal-editor）
  padding: 0 $spacing-2xl;
}

.date-title {
  font-size: $font-2xl;
  font-weight: $font-semibold;
}

.journal-editor {
  width: 100%;
}

/* 正文左右对称预留 48px（$spacing-2xl）内边距：左侧作为拖拽手柄槽位（手柄悬停时
   浮现在槽位内，不再溢出日志卡片与编辑列），右侧保持留白对称——与 PageBlock
   编辑区 "max-width 800 + padding 0 48" 的既有模式一致。
   drag-reorder 的 takeoverPosition 以 ProseMirror 内容根左缘为下界夹取，
   槽位宽度与手柄整体宽度 48px 精确匹配 */
.journal-editor :deep(.ProseMirror) {
  padding: 0 $spacing-2xl;
}
</style>
