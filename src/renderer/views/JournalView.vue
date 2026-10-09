<template>
  <n-flex class="journal-view" vertical>
    <n-spin v-if="daysLoading" class="loading" />
    <n-scrollbar v-else ref="scrollbarRef" @scroll="onScroll">
      <template v-for="(day, index) in days" :key="day.date">
        <JournalBlock :day="day" />
        <n-divider v-if="index < days.length - 1" />
      </template>
    </n-scrollbar>
  </n-flex>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, watch } from "vue";
import type { ScrollbarInst } from "naive-ui";
import JournalBlock from "@/renderer/components/editor/containers/JournalBlock.vue";
import { useJournal } from "@/renderer/composables/useJournal";
import { useConfig } from "@/renderer/composables/useConfig";

const { days, daysLoading, loadingMoreDays, hasMoreDays, loadRecentDays, loadMoreDays, clearDays } =
  useJournal();
const { workspace } = useConfig();

const scrollbarRef = ref<ScrollbarInst | null>(null);
const scrollTop = ref(0);

function onScroll(e: Event) {
  const target = e.target as HTMLElement;
  if (!target) return;
  scrollTop.value = target.scrollTop;
  // 滚动到接近底部时自动加载更早的日志时间线
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 40) {
    void loadMoreJournals();
  }
}

async function loadMoreJournals() {
  if (daysLoading.value || loadingMoreDays.value || !hasMoreDays.value) return;
  await loadMoreDays();
}

async function loadData() {
  await loadRecentDays(5);
}

watch(
  days,
  () => {
    const savedScrollTop = scrollTop.value;
    nextTick(() => {
      if (savedScrollTop > 0) {
        scrollbarRef.value?.scrollTo({ top: savedScrollTop });
      }
    });
  },
  { deep: true, flush: "pre" },
);

watch(
  () => workspace.value,
  async () => {
    clearDays();
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
  height: 100%;
}

/* 滚动容器通栏，滚动条位于页面最右侧；内容居中并限制在 800px */
.journal-view :deep(.n-scrollbar-content) {
  width: 100%;
  min-width: 0;
  /* 覆盖 naive-ui 的 min-width: 100%，使 max-width 生效 */
  max-width: 900px;
  margin: 0 auto;
  padding: $spacing-lg $spacing-md;
}

.loading {
  padding: calc($spacing-2xl * 2) 0;
}
</style>
