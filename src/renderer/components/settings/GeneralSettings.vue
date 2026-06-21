<template>
  <n-scrollbar class="general-settings">
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.ABOUT_SETTINGS.CURRENT_VERSION")
            }}</n-text>
          <n-text class="setting-desc">PenTip V{{ version }}</n-text>
          <n-text class="setting-link">{{ t("SETTINGS.GENERAL_SETTINGS.UPDATE_RECORD") }}</n-text>
        </n-flex>

        <n-button type="primary" @click="checkUpdate">
          {{ t("SETTINGS.ABOUT_SETTINGS.CHECK_UPDATE") }}
        </n-button>
      </n-flex>
      <n-divider />
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.GENERAL_SETTINGS.THEME")
            }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.GENERAL_SETTINGS.SELECT_THEME_DESC") }}</n-text>
        </n-flex>
        <n-select v-model:value="themeMode" :options="themeOptions" class="setting-select" />
      </n-flex>
      <n-divider />
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.GENERAL_SETTINGS.LOCALE")
            }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.GENERAL_SETTINGS.SELECT_LOCALE_DESC") }}</n-text>
        </n-flex>
        <n-select v-model:value="locale" :options="localeOptions" class="setting-select" />
      </n-flex>
      <n-divider />
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.ACCENT_COLOR") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.GENERAL_SETTINGS.SELECT_ACCENT_COLOR_DESC") }}</n-text>
        </n-flex>
        <n-space class="theme-color-space">
          <ColorCard v-for="opt in themeColorOptions" :key="opt.themeColor" :label="opt.label" :value="opt.colorHex"
            :selected="opt.isSelected" @click="() => selectThemeColor(opt.themeColor)" />
        </n-space>
      </n-flex>
    </n-card>

    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.DATA_MANAGER_SETTINGS.WORKSPACE")
            }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.GENERAL_SETTINGS.CHOOSE_FOLDER_DESC") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.GENERAL_SETTINGS.CURRENT_FOLDER") }}:&nbsp;
            {{ workspace }}</n-text>
        </n-flex>
        <n-button size="medium" type="primary" @click="selectWorkspace">
          {{ t("ACTION.COMMON.CHANGE") }}
        </n-button>
      </n-flex>
    </n-card>
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { AppConfig } from "@/shared/types";
import { useConfig } from "@/renderer/composables/useConfig";
import ColorCard from "@/renderer/components/base/ColorCard.vue";
import { setLocale } from "@/renderer/plugins/i18n";
import {
  THEME_MODE,
  LOCALE,
  ErrorCode,
  getThemeThemePrimaryColor,
  type ThemeMode,
} from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";

defineProps<{ config: AppConfig | null }>();

const { t } = useI18n();
const configStore = useConfig();
const {
  version,
  workspace,
  themeMode: configThemeMode,
  themeColor,
  locale: configLocale,
  updateThemeMode,
  updateLocale,
  updateThemeColor,
  updateWorkspace,
} = configStore;

const themeMode = ref<ThemeMode>(THEME_MODE.LIGHT);

onMounted(() => {
  themeMode.value = configThemeMode.value;
});

const themeOptions = computed(() => [
  { label: t("SETTINGS.GENERAL_SETTINGS.DARK"), value: THEME_MODE.DARK },
  { label: t("SETTINGS.GENERAL_SETTINGS.LIGHT"), value: THEME_MODE.LIGHT },
  { label: t("SETTINGS.GENERAL_SETTINGS.SYSTEM"), value: THEME_MODE.SYSTEM },
]);

watch(themeMode, (newVal) => {
  if (newVal !== configThemeMode.value) {
    logger.debug("更新主题", { newThemeMode: newVal });
    updateThemeMode(newVal);
  }
});

const locale = ref<string>(LOCALE.ZH);

const localeOptions = computed(() => [
  { label: t("SETTINGS.GENERAL_SETTINGS.LOCALE_ZH_CN"), value: LOCALE.ZH },
  { label: t("SETTINGS.GENERAL_SETTINGS.LOCALE_EN_US"), value: LOCALE.EN },
]);

onMounted(() => {
  locale.value = configLocale.value;
});

watch(locale, async (newLocale) => {
  if (newLocale && newLocale !== configLocale.value) {
    await setLocale(newLocale);
    updateLocale(newLocale);
  }
});

const primaryColor = computed(() => getThemeThemePrimaryColor(themeMode.value));

const themeColorOptions = computed(() =>
  primaryColor.value.map((color) => ({
    themeColor: color.themeColor,
    label: t(`SETTINGS.COLOR.${color.themeColor.toUpperCase()}`),
    colorHex: color.colorHex,
    isSelected: themeColor.value === color.themeColor,
  })),
);

const selectThemeColor = (color: string) => {
  if (color !== themeColor.value) {
    logger.debug("更新主题颜色", { themeColor: color });
    updateThemeColor(color);
  }
};

const checkUpdate = async () => { };

const selectWorkspace = async () => {
  try {
    const result = await window.electronAPI.system.openDialog({
      properties: ["openDirectory", "createDirectory"],
      title: t("SETTINGS.DATA_MANAGER_SETTINGS.SELECT_WORKSPACE"),
    });
    if (!result.code || result.code !== ErrorCode.SUCCESS) return;
    const data = result.data as { canceled: boolean; filePaths: string[] };
    if (data && !data.canceled && data.filePaths.length > 0) {
      await updateWorkspace(data.filePaths[0]);
    }
  } catch (error) {
    logger.error("选择工作目录失败:", { error });
  }
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/variables.scss" as *;

.general-settings {
  max-height: 100%;
}

.setting-card {
  margin-bottom: $spacing-md;
  background-color: var(--bg-secondary);
  border-radius: $radius-md;
}

.setting-row {
  margin-bottom: $spacing-md;
  align-items: center;
  min-height: 34px;
  justify-content: space-between !important;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-content {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 0 !important;
}

.setting-label {
  width: 130px;
  font-size: $font-base;
  margin-bottom: $spacing-xs;
}

.setting-desc {
  font-size: $font-xs;
  color: var(--text-third);
}

.setting-link {
  font-size: $font-xs;
  color: var(--text-third);
  cursor: pointer;

  &:hover {
    color: var(--primary-color);
  }
}



.setting-select {
  width: 150px;
}

.setting-value {
  margin: 0;
  color: var(--text-color-2);
  font-size: $font-sm;
}

.theme-color-space {
  align-items: center;
  justify-content: flex-start;
}
</style>
