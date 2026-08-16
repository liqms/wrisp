<template>
  <n-flex class="journal-view" vertical>
    <n-spin v-if="loading" class="loading" />
    <n-scrollbar v-else ref="scrollbarRef" @scroll="onScroll">
      <template v-for="(journal, index) in recentJournals" :key="journal.id">
        <JournalBlock :journal="journal" />
        <n-divider v-if="index < recentJournals.length - 1" />
      </template>
    </n-scrollbar>
  </n-flex>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, watch } from "vue";
import { useDialog, type ScrollbarInst } from "naive-ui";
import JournalBlock from "@/renderer/components/editor/JournalBlock.vue";
import { useJournal } from "@/renderer/composables/useJournal";
import { useConfig } from "@/renderer/composables/useConfig";
import { TimeUtil } from "@/shared/utils";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const dialog = useDialog();
const { recentJournals, loading, getRecentDays, createJournal, clearJournals, checkTodayJournalExists, syncLocalFiles } =
  useJournal({ recentDays: 5 });
const { workspace } = useConfig();

const scrollbarRef = ref<ScrollbarInst | null>(null);
const scrollTop = ref(0);
let prevTotalCount = 0;

function onScroll(e: Event) {
  const target = e.target as EventTarget;
  if (target) {
    scrollTop.value = (target as HTMLElement).scrollTop;
  }
}

async function ensureTodayJournal() {
  const today = TimeUtil.getLocalDateString();
  const hasToday = recentJournals.value.some((j) => j.date === today);
  if (hasToday) return;

  const fileExists = await checkTodayJournalExists(today);
  if (fileExists) {
    return new Promise<void>((resolve) => {
      dialog.warning({
        title: t("TIPS.JOURNAL.LOAD_EXISTING_TITLE"),
        content: t("TIPS.JOURNAL.LOAD_EXISTING_CONTENT"),
        positiveText: t("ACTION.COMMON.LOAD"),
        negativeText: t("ACTION.COMMON.OVERWRITE"),
        async onPositiveClick() {
          await syncLocalFiles();
          await getRecentDays(5);
          resolve();
          return true;
        },
        async onNegativeClick() {
          await createJournal({ date: today, content: "" });
          await getRecentDays(5);
          resolve();
          return true;
        },
        onClose: () => {
          resolve();
        },
      });
    });
  }

  const id = await createJournal({ date: today, content: "" });
  if (id) {
    await getRecentDays(5);
  }
}

async function loadData() {
  await getRecentDays(5);
  await ensureTodayJournal();
  prevTotalCount = recentJournals.value.length;
}

watch(
  recentJournals,
  () => {
    const currentTotal = recentJournals.value.length;
    const savedScrollTop = scrollTop.value;

    prevTotalCount = currentTotal;

    nextTick(() => {
      if (prevTotalCount > 0 && savedScrollTop > 0) {
        scrollbarRef.value?.scrollTo({ top: savedScrollTop });
      }
    });
  },
  { deep: true, flush: "pre" },
);

watch(
  () => workspace.value,
  async () => {
    clearJournals();
    await loadData();
  },
);

onMounted(async () => {
  await loadData();
});
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.journal-view {
  max-width: 800px;
  margin: 0 auto;
  padding: $spacing-xl $spacing-md;
  height: 100%;
}

.empty {
  padding: calc($spacing-2xl * 2) 0;
}

.loading {
  padding: calc($spacing-2xl * 2) 0;
}
</style>
