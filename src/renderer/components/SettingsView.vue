<template>
  <n-modal v-model:show="showModal" preset="card" :title="t('APP.BASE.SETTINGS')"
    :style="{ maxHeight: '80vh', maxWidth: '900px', width: 'calc(100% - 60px)' }"
    :segmented="{ content: 'soft', footer: 'soft' }" :mask-closable="false" header-style="font-size: 16px;">
    <n-flex class="settings-container">
      <div class="settings-sidebar">
        <n-menu v-model:value="activeMenuKey" :options="menuOptions" />
      </div>
      <n-flex vertical :size="0" class="settings-main">
        <n-breadcrumb class="settings-breadcrumb">
          <n-breadcrumb-item v-for="(item, index) in breadcrumbItems" :key="item.key" class="breadcrumb-item"
            :clickable="index < breadcrumbItems.length - 1" @click="navigateBreadcrumb(item)">
            {{ item.label }}
            <n-icon :component="ArrowForwardIosOutlined" size="12" class="nav-arrow" />
          </n-breadcrumb-item>
        </n-breadcrumb>
        <n-scrollbar class="settings-content">
          <component :is="currentComponent" :config="config" @enterMarketplace="enterMarketplace"
            @navigate="onNavigate" />
        </n-scrollbar>
      </n-flex>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { watch, ref, computed, markRaw, h, type Component } from "vue";
import { NIcon } from "naive-ui";
import { useI18n } from "vue-i18n";
import { useConfig } from "@/renderer/composables/useConfig";
import GeneralSettings from "@/renderer/components/settings/GeneralSettings.vue";
import ModelSettings from "@/renderer/components/settings/ModelSettings.vue";
import ModelProvidersPage from "@/renderer/components/settings/ModelProvidersPage.vue";
import ModelDefaultsPage from "@/renderer/components/settings/ModelDefaultsPage.vue";
import KeymapSettings from "@/renderer/components/settings/KeymapSettings.vue";
import TemplateSettings from "@/renderer/components/settings/TemplateSettings.vue";
import { DiceOutline, DocumentTextOutline, OptionsOutline } from "@vicons/ionicons5";

import { ArrowForwardIosOutlined, KeyboardAltOutlined } from "@vicons/material";
import { useRouter } from "vue-router";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "update:showSettings", value: boolean): void;
}>();

const showModal = computed({
  get: () => props.show,
  set: (value) => emit("update:showSettings", value),
});

const router = useRouter();

function enterMarketplace() {
  showModal.value = false;
  router.push("/marketplace");
}

const { t } = useI18n();
const configStore = useConfig();
const config = configStore.config;

const STORAGE_KEY = "WRISP_SETTINGS_MENU_KEY";

const activeMenuKey = ref<string>(
  localStorage.getItem(STORAGE_KEY) || "general",
);

// 子页面 key，例如 "model.providers" / "model.defaults"，为空表示顶级页面
const activeSubPage = ref<string | null>(null);

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) });
}

watch(showModal, (visible) => {
  if (visible) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      activeMenuKey.value = saved;
    }
    // 每次打开定位到顶级页面
    activeSubPage.value = null;
  }
});

watch(activeMenuKey, (key) => {
  localStorage.setItem(STORAGE_KEY, key);
  // 切换到其它顶级菜单时回到其根页面
  activeSubPage.value = null;
});

const menuOptions = computed(() => [
  {
    key: "general",
    label: t("SETTINGS.GENERAL"),
    icon: renderIcon(OptionsOutline),
  },
  {
    key: "model",
    label: t("SETTINGS.AI_SETTINGS.INTELLIGENT"),
    icon: renderIcon(DiceOutline),
  },
  {
    key: "keymap",
    label: t("SETTINGS.KEYMAP"),
    icon: renderIcon(KeyboardAltOutlined),
  },
  {
    key: "template",
    label: t("APP.BASE.TEMPLATE"),
    icon: renderIcon(DocumentTextOutline),
  },
]);

interface BreadcrumbItem {
  key: string;
  label: string;
}

const componentMap: Record<string, Component> = {
  general: markRaw(GeneralSettings),
  model: markRaw(ModelSettings),
  keymap: markRaw(KeymapSettings),
  template: markRaw(TemplateSettings),
};

const subPageComponentMap: Record<string, Component> = {
  "model.providers": markRaw(ModelProvidersPage),
  "model.defaults": markRaw(ModelDefaultsPage),
};

// 当前展示的页面：优先子页面，否则取顶级菜单页
const currentComponent = computed<Component | null>(() => {
  if (activeSubPage.value) {
    return subPageComponentMap[activeSubPage.value] || null;
  }
  return componentMap[activeMenuKey.value] || null;
});

// 按菜单 key 定义各顶级页面的面包屑路径；子页面追加更多层级（如 智能 > 模型服务商）
const breadcrumbMap: Record<string, { key: string; labelKey: string }[]> = {
  general: [{ key: "general", labelKey: "SETTINGS.GENERAL" }],
  model: [{ key: "model", labelKey: "SETTINGS.AI_SETTINGS.INTELLIGENT" }],
  keymap: [{ key: "keymap", labelKey: "SETTINGS.KEYMAP" }],
  template: [{ key: "template", labelKey: "APP.BASE.TEMPLATE" }],
};

const subPageBreadcrumbMap: Record<string, { key: string; labelKey: string }[]> = {
  "model.providers": [
    { key: "model", labelKey: "SETTINGS.AI_SETTINGS.INTELLIGENT" },
    { key: "model.providers", labelKey: "SETTINGS.PROVIDER_MODELS" },
  ],
  "model.defaults": [
    { key: "model", labelKey: "SETTINGS.AI_SETTINGS.INTELLIGENT" },
    { key: "model.defaults", labelKey: "SETTINGS.DEFAULT_MODEL_GENERAL" },
  ],
};

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const path = activeSubPage.value
    ? subPageBreadcrumbMap[activeSubPage.value] || []
    : breadcrumbMap[activeMenuKey.value] || [];
  return path.map((item) => ({ key: item.key, label: t(item.labelKey) }));
});

// 点击面包屑跳转：顶级层级回到根页面，子层级进入对应子页面
function navigateBreadcrumb(item: BreadcrumbItem) {
  const isSubPage = item.key.includes(".");
  if (isSubPage) {
    const base = item.key.split(".")[0];
    activeMenuKey.value = base;
    activeSubPage.value = item.key;
  } else {
    activeMenuKey.value = item.key;
    activeSubPage.value = null;
  }
}

// 子页面跳转入口（由页面组件 emit 'navigate' 触发）
function onNavigate(pageKey: string) {
  const base = pageKey.split(".")[0];
  activeMenuKey.value = base;
  activeSubPage.value = pageKey;
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.settings-container {
  height: 60vh;
  gap: 0;
  flex-flow: nowrap !important;
}

.settings-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.settings-main {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.settings-breadcrumb {
  flex-shrink: 0;
  padding: 0 0 $spacing-sm 0;
  font-size: $font-md;
}

.breadcrumb-item {
  flex-shrink: 0;
  font-size: $font-md;
  color: var(--text-third);
  cursor: pointer;

  &:last-child {
    cursor: default;
    color: var(--text-primary);
    .nav-arrow {
      display: none;
    }
  }
  &:hover {
    color: var(--text-primary);
  }
}

.nav-arrow {
  color: var(--text-third);
  flex-shrink: 0;
  margin: 0 $spacing-sm;
}



.settings-content {
  flex: 1;
  min-width: 0;
  padding: $spacing-sm $spacing-md;
}

@media screen and (max-width: 900px) {
  .settings-sidebar {
    width: 160px;
  }
}
</style>
