<template>
  <n-flex class="capture-view" vertical>
    <n-spin v-if="loading" class="loading" />
    <n-scrollbar ref="scrollbarRef" @scroll="onScroll" v-else>
      <template v-for="group in dateGroups" :key="group.date">
        <n-flex class="date-group" vertical>
          <n-flex class="date-header" align="center">
            <n-text class="date-header-text">{{ group.date }}</n-text>
          </n-flex>
          <n-divider class="header-line" />

          <n-flex
            v-for="(capture, idx) in group.captures.filter(
              (c) => c && (c.id || c.content),
            )"
            :key="capture.id || `${group.date}-${idx}`"
            class="capture-item"
            vertical
          >
            <SemanticBlockItem v-if="capture" :block="capture" />
          </n-flex>
        </n-flex>
      </template>
      <n-empty
        v-if="dateGroups.length === 0"
        description="暂无记录"
        class="empty"
      />
    </n-scrollbar>
    <NewBlockCreator class="new-block-creator-wrapper" />
    <n-flex align="center" justify="center">
      <n-text class="footer-tips" size="small" type="tertiary">
        {{ $t("TIPS.CAPTURE.SEND_TIP") }}
      </n-text>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, nextTick, watch } from "vue";
import { NFlex, NText, NSpin, NEmpty } from "naive-ui";
import NewBlockCreator from "@/renderer/components/editor/NewBlockCreator.vue";
import SemanticBlockItem from "@/renderer/components/editor/SemanticBlockItem.vue";
import { useCapture } from "@/renderer/composables/useCapture";
import type { SemanticBlock } from "@/renderer/components/editor/SemanticGroup";
import { useConfig } from "@/renderer/composables/useConfig";

const { dateRangeCaptures, loading, getCapturesByDateRange, clearCaptures } =
  useCapture();
const { workspace } = useConfig();

const scrollbarRef = ref<any>(null);
const scrollTop = ref(0);
let prevTotalCount = 0;

function onScroll(e: Event) {
  const target = e.target as HTMLElement;
  if (target) {
    scrollTop.value = target.scrollTop;
  }
}

function toSemanticBlock(capture: any): SemanticBlock {
  return {
    id: capture.id,
    content: capture.content ?? "",
    content_type: capture.content_type ?? "",
    split_index: capture.split_index,
    metadata: capture.metadata,
    word_count: capture.word_count,
    created_at: capture.created_at,
    updated_at: capture.updated_at,
  };
}

const dateGroups = computed(() =>
  dateRangeCaptures.value.map((group) => ({
    ...group,
    captures: group.captures.map(toSemanticBlock),
  })),
);

function scrollToBottom() {
  setTimeout(() => {
    nextTick(() => {
      scrollbarRef.value?.scrollTo({ top: 99999 });
    });
  }, 100);
}

async function loadData() {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await getCapturesByDateRange(startDate, endDate);
  prevTotalCount = dateRangeCaptures.value.reduce(
    (sum, g) => sum + g.captures.length,
    0,
  );
  scrollToBottom();
}

watch(
  dateRangeCaptures,
  () => {
    const currentTotal = dateRangeCaptures.value.reduce(
      (sum, g) => sum + g.captures.length,
      0,
    );
    const isAdding = currentTotal > prevTotalCount;
    const savedScrollTop = scrollTop.value;

    prevTotalCount = currentTotal;

    nextTick(() => {
      if (isAdding) {
        scrollToBottom();
      } else if (prevTotalCount > 0 && savedScrollTop > 0) {
        scrollbarRef.value?.scrollTo({ top: savedScrollTop });
      }
    });
  },
  { deep: true, flush: "pre" },
);

watch(
  () => workspace.value,
  async () => {
    clearCaptures();
    await loadData();
  },
);

onMounted(async () => {
  await loadData();
});
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.capture-view {
  max-width: 800px;
  margin: 0 auto;
  padding: $spacing-xl $spacing-md;
  height: 100%;
}

.date-group {
  margin-bottom: $spacing-lg;
}

.date-header {
  padding: $spacing-xs 0 $spacing-sm;
}

.date-header-text {
  font-size: $font-md;
  font-weight: $font-semibold;
}

.header-line {
  margin: 0 0 $spacing-sm;
}

.capture-item {
  margin-bottom: $spacing-sm;
}

.capture-content-type {
  font-size: $font-xs;
  color: var(--text-secondary);
}

.empty {
  padding: calc($spacing-2xl * 2) 0;
}

.loading {
  padding: calc($spacing-2xl * 2) 0;
}

.new-block-creator-wrapper {
  margin-top: auto;
  z-index: 1000;
}

.footer-tips {
  font-size: $font-xs;
  color: var(--text-disabled);
}
</style>
