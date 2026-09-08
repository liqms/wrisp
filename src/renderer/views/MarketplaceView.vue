<template>
  <div class="marketplace-view">
    <div class="mv-header">
      <n-button quaternary circle size="small" @click="goBack">
        <template #icon>
          <ArrowBackOutlined />
        </template>
      </n-button>
      <div class="mv-title">
        <div class="mv-heading">{{ t("SETTINGS.MARKETPLACE.TITLE") }}</div>
        <div class="mv-subtitle">{{ t("SETTINGS.MARKETPLACE.SUBTITLE") }}</div>
      </div>
      <n-button quaternary circle size="small" :loading="loading" @click="load(true)">
        <template #icon>
          <RefreshOutlined />
        </template>
      </n-button>
    </div>

    <n-alert v-if="offline && items.length > 0" type="warning" :show-icon="true" class="mv-offline">
      {{ t("SETTINGS.MARKETPLACE.OFFLINE") }}
    </n-alert>

    <n-tabs v-model:value="activeType" type="line" class="mv-tabs" @update:value="onTypeChange">
      <n-tab name="slash">{{ t("SETTINGS.MARKETPLACE.TAB_SLASH") }}</n-tab>
      <n-tab name="page">{{ t("SETTINGS.MARKETPLACE.TAB_PAGE") }}</n-tab>
      <n-tab name="skill">{{ t("SETTINGS.MARKETPLACE.TAB_SKILL") }}</n-tab>
    </n-tabs>

    <div class="mv-toolbar">
      <n-input v-model:value="keyword" clearable size="small"
        :placeholder="t('SETTINGS.MARKETPLACE.SEARCH_PLACEHOLDER')" class="mv-search">
        <template #prefix>
          <SearchOutlined />
        </template>
      </n-input>
      <n-select v-model:value="selectedTag" :options="tagOptions" clearable size="small"
        :placeholder="t('SETTINGS.MARKETPLACE.FILTER_TAG')" class="mv-tag-select" />
    </div>

    <n-spin :show="loading" class="mv-spin">
      <div v-if="loadError" class="mv-empty">
        {{ t("SETTINGS.MARKETPLACE.LOAD_FAILED") }}
      </div>
      <div v-else-if="filteredItems.length === 0" class="mv-empty">
        {{ t("SETTINGS.MARKETPLACE.EMPTY") }}
      </div>
      <div v-else class="mv-grid">
        <TemplateCard v-for="item in filteredItems" :key="item.id" :item="item" :expanded="expanded.has(item.id)"
          @toggle="toggleExpanded" @install="handleInstall" @uninstall="handleUninstall" />
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useConfig } from "@/renderer/composables/useConfig";
import { useTemplateStore } from "@/renderer/store/template.store";
import { filterMarketplace } from "@/renderer/components/marketplace/marketplace-filter";
import TemplateCard from "@/renderer/components/marketplace/TemplateCard.vue";
import { RESOURCE_TYPE, type ResourceType } from "@/shared/enums/resource.enums";
import { LOCALE } from "@/shared/enums";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";
import {
  ArrowBackOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@vicons/material";

const { t } = useI18n();
const router = useRouter();
const { locale } = useConfig();
const store = useTemplateStore();

const useEn = computed(() => locale.value === LOCALE.EN);

const activeType = ref<ResourceType>(RESOURCE_TYPE.SLASH);
const keyword = ref("");
const selectedTag = ref<string | null>(null);
const loading = ref(false);
const loadError = ref(false);
const expanded = ref<Set<string>>(new Set());

const catalog = computed(() => store.marketplace[activeType.value] ?? null);
const items = computed(() => catalog.value?.items ?? []);
const offline = computed(() => catalog.value?.offline ?? false);

/** 当前语言下的全部去重标签（用于下拉筛选） */
const allTags = computed(() => {
  const tags = new Set<string>();
  for (const item of items.value) {
    for (const tag of item.tags) {
      tags.add(useEn.value ? tag.en : tag.zh);
    }
  }
  return [...tags];
});
const tagOptions = computed(() =>
  allTags.value.map((tag) => ({ label: tag, value: tag })),
);

const filteredItems = computed(() =>
  filterMarketplace(items.value, {
    keyword: keyword.value,
    tag: selectedTag.value ?? "",
    locale: locale.value,
  }),
);

async function load(force = false): Promise<void> {
  loading.value = true;
  loadError.value = false;
  try {
    const res = await window.electronAPI.template.getMarketplace(
      activeType.value,
      force,
    );
    if (res.success && res.data) {
      store.marketplace[activeType.value] = res.data as MarketplaceCatalog;
    } else {
      loadError.value = true;
    }
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function onTypeChange(): void {
  expanded.value = new Set();
  selectedTag.value = null;
  load();
}

function goBack(): void {
  if (window.history.length > 1) router.back();
  else router.push("/welcome");
}

function toggleExpanded(id: string): void {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

async function handleInstall(item: MarketplaceItem): Promise<void> {
  await store.installMarketplace(activeType.value, item.id);
  await load(true);
}

async function handleUninstall(item: MarketplaceItem): Promise<void> {
  await store.uninstallMarketplace(activeType.value, item.id);
  await load(true);
}

let disposeUpdated: (() => void) | undefined;

onMounted(() => {
  load();
  disposeUpdated = window.electronAPI.resource.onUpdated((changed) => {
    if (changed.includes(activeType.value)) load(true);
  });
});

watch(activeType, () => {
  expanded.value = new Set();
  selectedTag.value = null;
  load();
});

onUnmounted(() => {
  disposeUpdated?.();
});
</script>

<style scoped lang="scss">
.marketplace-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.mv-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mv-title {
  flex: 1;
  min-width: 0;
}

.mv-heading {
  font-size: 18px;
  font-weight: 600;
}

.mv-subtitle {
  font-size: 12px;
  color: var(--n-text-color-3, #999);
}

.mv-offline {
  margin-bottom: 0;
}

.mv-toolbar {
  display: flex;
  gap: 8px;

  .mv-search {
    flex: 1;
    max-width: 320px;
  }

  .mv-tag-select {
    width: 160px;
  }
}

.mv-spin {
  flex: 1;
  min-height: 200px;
}

.mv-empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--n-text-color-3, #999);
  font-size: 14px;
}

.mv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
</style>