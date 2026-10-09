<template>
  <n-flex class="journal-block" :class="{ 'is-today': isToday }" vertical>
    <!-- 日期标题行 -->
    <n-flex class="date-header" align="center" justify="space-between">
      <n-text class="date-title" depth="secondary">
        {{ displayDate }}
      </n-text>
    </n-flex>

    <!-- 今日：条目录入 composer（legacy 日同样保留录入入口，裁定 T9-11） -->
    <JournalEntryComposer v-if="isToday" class="entry-composer" />

    <!-- 旧版整篇日志：导入入口（导入后由条目接管渲染） -->
    <n-alert v-if="day.has_legacy_file" type="info" class="legacy-alert" :bordered="false">
      <div class="legacy-body">
        <span class="legacy-hint">{{ t("TIPS.JOURNAL.LEGACY_HINT") }}</span>
        <n-button size="small" type="primary" :loading="importing" @click="doImport">
          {{ t("TIPS.JOURNAL.IMPORT_FILE") }}
        </n-button>
      </div>
    </n-alert>

    <!-- 条目列表 -->
    <div class="entry-list">
      <JournalEntryItem v-for="e in day.entries" :key="e.id" :entry="e" />
    </div>
  </n-flex>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NAlert } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { JournalDayView } from "@/shared/types";
import { TimeUtil } from "@/shared/utils";
import { useConfig } from "@/renderer/composables/useConfig";
import { useJournal } from "@/renderer/composables/useJournal";
import { useFrontendNotification } from "@/renderer/composables/useNotification";
import JournalEntryComposer from "./JournalEntryComposer.vue";
import JournalEntryItem from "./JournalEntryItem.vue";

const props = defineProps<{
  day: JournalDayView;
}>();

const { t } = useI18n();
const { requestImportDayFile } = useJournal();
const notify = useFrontendNotification({
  title: t("TIPS.JOURNAL.IMPORT_TITLE"),
  content: "",
});
const { journalDateFormat } = useConfig();

const importing = ref(false);

const todayStr = TimeUtil.getLocalDateString();
const isToday = computed(() => props.day.date === todayStr);

/**
 * 按配置的日期格式显示日期标题
 * day.date 为 YYYY-MM-DD 字符串，拆分为本地时间构造 Date，避免 ISO 字符串按 UTC 解析产生时区偏移
 */
const displayDate = computed(() => {
  const dateStr = props.day.date || "";
  const parts = dateStr.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    return dateStr;
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return TimeUtil.format(date, journalDateFormat.value || "yyyy-MM-dd");
});

async function doImport() {
  importing.value = true;
  const res = await requestImportDayFile(props.day.date);
  importing.value = false;
  if (res) {
    notify.success(
      t("TIPS.JOURNAL.IMPORT_TITLE"),
      t("TIPS.JOURNAL.IMPORT_RESULT", { imported: res.imported, updated: res.updated, skipped: res.skipped }),
    );
  }
}
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.journal-block {
  padding: $spacing-md;
  border-radius: $radius-md;
  transition: background $transition-base;

  &.is-today {
    min-height: 300px;
  }
}

.date-header {
  margin-bottom: $spacing-sm;
  // 左右内边距与正文一致，日期标题与正文左对齐
  padding: 0 $spacing-2xl;
}

.date-title {
  font-size: $font-2xl;
  font-weight: $font-semibold;
}

.entry-composer {
  padding: 0 $spacing-2xl;
}

.legacy-alert {
  margin: 0 $spacing-2xl $spacing-sm;
}

.legacy-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
}

.legacy-hint {
  font-size: $font-sm;
}

.entry-list {
  padding: 0 $spacing-2xl;
}
</style>
