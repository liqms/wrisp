<template>
  <n-modal v-model:show="showModal" preset="card" :title="t('APP.BASE.SETTINGS')"
    :style="{ maxHeight: '80vh', maxWidth: '900px' }" :segmented="{ content: 'soft', footer: 'soft' }"
    :mask-closable="false">
    <n-flex class="settings-container">
      <div class="settings-sidebar">
        <n-menu :options="menuOptions" v-model:value="activeMenuKey" />
      </div>
      <n-scrollbar class="settings-content">
        <component :is="currentComponent" :config="config" />
      </n-scrollbar>
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
import KeymapSettings from "@/renderer/components/settings/KeymapSettings.vue";
import { DiceOutline, OptionsOutline } from "@vicons/ionicons5";

import { KeyboardAltOutlined } from "@vicons/material";

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

const { t } = useI18n();
const configStore = useConfig();
const config = configStore.config;

const STORAGE_KEY = "PENTIP_SETTINGS_MENU_KEY";

const activeMenuKey = ref<string>(
  localStorage.getItem(STORAGE_KEY) || "general",
);

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) });
}

watch(showModal, (visible) => {
  if (visible) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      activeMenuKey.value = saved;
    }
  }
});

watch(activeMenuKey, (key) => {
  localStorage.setItem(STORAGE_KEY, key);
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
]);

const componentMap: Record<string, Component> = {
  general: markRaw(GeneralSettings),
  model: markRaw(ModelSettings),
  keymap: markRaw(KeymapSettings),
};

const currentComponent = computed<Component | null>(() => {
  return componentMap[activeMenuKey.value] || null;
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.settings-container {
  height: 60vh;
  gap: 0;
  flex-flow: nowrap !important;
}

.settings-sidebar {
  width: 230px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.settings-content {
  flex: 1;
  min-width: 0;
  padding: $spacing-sm $spacing-md;
}

@media screen and (max-width: 900px) {
  .settings-sidebar {
    width: 180px;
  }
}
</style>
