<template>
  <n-modal v-model:show="visible" preset="card" :style="{ maxWidth: '640px', borderRadius: '12px' }" :mask-closable="true" @after-leave="reset">
    <n-input
      v-model:value="query"
      :placeholder="t('TIPS.GLOBAL_SEARCH.PLACEHOLDER')"
      clearable
      autofocus
      size="large"
      @keydown="handleKeydown"
    >
      <template #prefix>
        <n-icon :component="SearchIcon" />
      </template>
    </n-input>

    <div class="search-body">
      <n-spin v-if="loading" size="small" class="search-spin" />

      <template v-else-if="flatItems.length > 0">
        <div v-for="group in groupedResults" :key="group.type" class="search-group">
          <div class="search-group-header">
            <n-icon :component="group.icon" size="14" />
            <span>{{ group.label }}</span>
            <n-text depth="3" class="search-group-count">{{ group.items.length }}</n-text>
          </div>
          <div
            v-for="item in group.items"
            :key="item.type + item.id"
            class="search-item"
            :class="{ active: flatIndex(item) === selectedIndex }"
            @click="navigateTo(item)"
            @mouseenter="selectedIndex = flatIndex(item)"
          >
            <div class="search-item-title">{{ item.title }}</div>
            <div v-if="item.content" class="search-item-content">{{ item.content }}</div>
          </div>
        </div>
      </template>

      <div v-else-if="query && !loading" class="search-empty">
        <n-text depth="3">{{ t('TIPS.GLOBAL_SEARCH.NO_RESULTS') }}</n-text>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { NModal, NInput, NSpin, NIcon, NText } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import {
  SearchOutline as SearchIcon,
  DocumentTextOutline as ChunkIcon,
  BookOutline as ConceptIcon,
  LibraryOutline as TopicIcon,
  FolderOpenOutline as ProjectIcon,
  FileTrayOutline as PageIcon,
} from "@vicons/ionicons5";
import { useSearch } from "@/renderer/composables/useSearch";
import type { SearchResult, SearchResultType } from "@/shared/types";

const { t } = useI18n();
const router = useRouter();
const { search, results, loading, clear } = useSearch();

const props = withDefaults(
  defineProps<{
    visible?: boolean;
  }>(),
  { visible: false },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
}>();

const query = ref("");
const selectedIndex = ref(0);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const visible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

// ── 分组 ──
const TYPE_META: Record<SearchResultType, { labelKey: string; icon: typeof ChunkIcon }> = {
  chunk: { labelKey: "TIPS.GLOBAL_SEARCH.SECTION_CHUNK", icon: ChunkIcon },
  concept: { labelKey: "TIPS.GLOBAL_SEARCH.SECTION_CONCEPT", icon: ConceptIcon },
  topic: { labelKey: "TIPS.GLOBAL_SEARCH.SECTION_TOPIC", icon: TopicIcon },
  project: { labelKey: "TIPS.GLOBAL_SEARCH.SECTION_PROJECT", icon: ProjectIcon },
  page: { labelKey: "TIPS.GLOBAL_SEARCH.SECTION_PAGE", icon: PageIcon },
};

const TYPE_ORDER: SearchResultType[] = ["chunk", "concept", "topic", "project", "page"];

const groupedResults = computed(() => {
  const groups: { type: SearchResultType; label: string; icon: typeof ChunkIcon; items: SearchResult[] }[] = [];
  for (const type of TYPE_ORDER) {
    const items = results.value.filter((r) => r.type === type);
    if (items.length > 0) {
      groups.push({
        type,
        label: t(TYPE_META[type].labelKey),
        icon: TYPE_META[type].icon,
        items,
      });
    }
  }
  return groups;
});

const flatItems = computed(() => groupedResults.value.flatMap((g) => g.items));

function flatIndex(item: SearchResult): number {
  return flatItems.value.indexOf(item);
}

// ── 防抖搜索 ──
watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!val || val.trim() === "") {
    clear();
    return;
  }
  debounceTimer = setTimeout(() => {
    search(val);
  }, 300);
});

watch(flatItems, () => {
  selectedIndex.value = 0;
});

// ── 弹窗打开时重置 ──
watch(visible, (val) => {
  if (val) {
    query.value = "";
    selectedIndex.value = 0;
  }
});

// ── 键盘导航 ──
function handleKeydown(e: KeyboardEvent): void {
  if (flatItems.value.length === 0) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % flatItems.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex.value =
      (selectedIndex.value - 1 + flatItems.value.length) % flatItems.value.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    const item = flatItems.value[selectedIndex.value];
    if (item) navigateTo(item);
  }
}

// ── 跳转 ──
function navigateTo(item: SearchResult): void {
  switch (item.type) {
    case "chunk":
      router.push("/journal");
      break;
    case "concept":
    case "topic":
      router.push("/wiki");
      break;
    case "project":
      router.push(`/projects/${item.id}`);
      break;
    case "page":
      if (item.projectId) {
        router.push(`/projects/${item.projectId}`);
      }
      break;
  }
  visible.value = false;
}

function reset(): void {
  query.value = "";
  selectedIndex.value = 0;
  clear();
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.search-body {
  margin-top: $spacing-md;
  max-height: 420px;
  overflow-y: auto;
}

.search-spin {
  display: flex;
  justify-content: center;
  padding: $spacing-lg 0;
}

.search-group {
  margin-bottom: $spacing-md;
}

.search-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-color-3, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.search-group-count {
  margin-left: auto;
  font-size: 11px;
}

.search-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover,
  &.active {
    background-color: var(--hover-color, rgba(0, 0, 0, 0.04));
  }
}

.search-item-title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-item-content {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-color-3, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-empty {
  display: flex;
  justify-content: center;
  padding: $spacing-lg 0;
}
</style>
