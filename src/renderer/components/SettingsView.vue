<template>
  <n-modal v-model:show="showModal" preset="card" :title="t('APP.BASE.SETTINGS')" class="settings-modal"
    :style="{ width: '800px', maxHeight: '80vh' }" :segmented="{ content: 'soft', footer: 'soft' }"
    :mask-closable="false">
    <n-flex class="settings-container">
      <n-anchor type="block" class="settings-anchor" :internal-scroll-container="scrollContainerRef">
        <n-anchor-link :title="t('SETTINGS.GENERAL')" href="#general" class="anchor-link" @click="handleAnchorClick" />
        <n-anchor-link :title="t('SETTINGS.DATA_MANAGER')" href="#data-manager" class="anchor-link"
          @click="handleAnchorClick" />
        <n-anchor-link :title="t('SETTINGS.ABOUT')" href="#about" class="anchor-link" @click="handleAnchorClick" />
      </n-anchor>
      <n-scrollbar class="settings-content">
        <div ref="scrollContainerRef">
          <n-card id="general" :title="t('SETTINGS.GENERAL')" size="small" class="settings-card">
            <n-flex justify="flex-start" align="center" class="setting-item">
              <n-text class="setting-label">{{
                t("SETTINGS.GENERAL_SETTINGS.THEME")
              }}</n-text>
              <n-select v-model:value="themeMode" :options="themeOptions" class="setting-select" />
            </n-flex>
            <n-flex justify="flex-start" align="center" class="setting-item">
              <n-text class="setting-label">{{
                t("SETTINGS.GENERAL_SETTINGS.LOCALE")
              }}</n-text>
              <n-select v-model:value="locale" :options="localeOptions" class="setting-select" />
            </n-flex>

            <n-flex justify="flex-start" align="center" class="setting-item">
              <n-text class="setting-label">{{
                t("SETTINGS.ACCENT_COLOR")
              }}</n-text>
              <n-space class="theme-color-space">
                <ColorCard v-for="opt in themeColorOptions" :key="opt.themeColor" :label="opt.label"
                  :value="opt.colorHex" :selected="opt.isSelected" @click="() => selectThemeColor(opt.themeColor)" />
              </n-space>
            </n-flex>
          </n-card>
          <n-card id="data-manager" :title="t('SETTINGS.DATA_MANAGER')" size="small" class="settings-card">
            <n-flex justify="flex-start" align="center" class="setting-item">
              <n-text class="setting-label">{{
                t("SETTINGS.DATA_MANAGER_SETTINGS.WORKSPACE")
              }}</n-text>
              <n-flex align="center" class="setting-value-container">
                <n-text class="setting-label-description">{{
                  workspace
                }}</n-text>
                <n-button size="tiny" type="primary" ghost @click="selectWorkspace">
                  {{ t("ACTION.COMMON.CHANGE") }}
                </n-button>
              </n-flex>
            </n-flex>
          </n-card>
          <n-card id="about" :title="t('SETTINGS.ABOUT')" size="small" class="settings-card">
            <n-flex justify="flex-start" align="center" class="setting-item">
              <n-text class="setting-label">
                {{ t("SETTINGS.ABOUT_SETTINGS.CURRENT_VERSION") }}:
              </n-text>
              <n-text class="setting-label-description">
                PenTip V{{ version }}
              </n-text>
              <n-button size="tiny" type="primary" ghost @click="checkUpdate">
                {{ t("SETTINGS.ABOUT_SETTINGS.CHECK_UPDATE") }}
              </n-button>
            </n-flex>
          </n-card>
        </div>
      </n-scrollbar>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { watch, ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { setLocale } from "@/renderer/plugins/i18n";
import {
  THEME_MODE,
  ThemeMode,
  LOCALE,
  THEME_COLOR,
  getThemeThemePrimaryColor,
} from "@/shared/enums";
import { useConfig } from "@/renderer/composables/useConfig";
import ColorCard from "@/renderer/components/base/ColorCard.vue";
import { logger } from "@/renderer/utils/logger.utils";
import { ErrorCode } from "@/shared/enums";

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
const config = useConfig();

const {
  themeMode: configThemeMode,
  themeColor: configThemeColor,
  locale: configLocale,
  defaultMiniProgramId: configDefaultMiniProgramId,
  version: configVersion,
  workspace: configWorkspace,
  updateThemeMode,
  updateThemeColor,
  updateDefaultMiniProgramId,
  updateWorkspace,
} = config;

const scrollContainerRef = ref<HTMLElement | null>(null);

const handleAnchorClick = (e: MouseEvent) => {
  e.preventDefault();
  const href = (e.currentTarget as HTMLElement).getAttribute("href");
  if (!href) return;
  const targetId = href.replace("#", "");
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const themeOptions = computed(() => [
  {
    label: t("SETTINGS.GENERAL_SETTINGS.DARK"),
    value: THEME_MODE.DARK,
  },
  {
    label: t("SETTINGS.GENERAL_SETTINGS.LIGHT"),
    value: THEME_MODE.LIGHT,
  },
]);

const primaryColor = computed(() => getThemeThemePrimaryColor(themeMode.value));

const themeColorOptions = computed(() => {
  return primaryColor.value.map((color) => ({
    themeColor: color.themeColor,
    label: t(`SETTINGS.COLOR.${color.themeColor.toUpperCase()}`),
    colorHex: color.colorHex,
    isSelected: themeColor.value === color.themeColor,
  }));
});

const localeOptions = computed(() => [
  {
    label: t("SETTINGS.GENERAL_SETTINGS.LOCALE_ZH_CN"),
    value: LOCALE.ZH,
  },
  {
    label: t("SETTINGS.GENERAL_SETTINGS.LOCALE_EN_US"),
    value: LOCALE.EN,
  },
]);

const themeMode = ref<ThemeMode>(THEME_MODE.LIGHT);
const themeColor = ref<string>(THEME_COLOR.GREEN);
const locale = ref<string>(LOCALE.ZH);
const defaultMiniProgramId = ref<string>("");
const version = ref("1.0.0");
const workspace = ref<string | null>("");

onMounted(async () => {
  await config.ensureLoaded();

  themeMode.value = configThemeMode.value;
  themeColor.value = configThemeColor.value;
  locale.value = configLocale.value;
  defaultMiniProgramId.value = configDefaultMiniProgramId.value;
  version.value = configVersion.value;
  workspace.value = configWorkspace.value;
});

watch(
  () => config,
  (newConfig) => {
    themeMode.value = newConfig.themeMode.value;
    themeColor.value = newConfig.themeColor.value;
    locale.value = newConfig.locale.value;
    defaultMiniProgramId.value = newConfig.defaultMiniProgramId.value;
    version.value = newConfig.version.value;
    workspace.value = newConfig.workspace.value;
  },
);

watch(themeMode, (newThemeMode) => {
  if (newThemeMode !== undefined) {
    if (newThemeMode === configThemeMode.value) {
      return;
    }
    logger.debug("更新主题", { newThemeMode });
    updateThemeMode(newThemeMode);
  }
});

const selectThemeColor = (color: string) => {
  if (color !== configThemeColor.value) {
    logger.debug("更新主题颜色", { themeColor: color });
    themeColor.value = color;
    updateThemeColor(themeColor.value);
  }
};

watch(locale, async (newLocale) => {
  if (newLocale !== undefined) {
    if (newLocale === configLocale.value) {
      return;
    }
    await setLocale(newLocale);
    config.updateLocale(newLocale);
  }
});

watch(defaultMiniProgramId, (newDefaultMiniProgramId) => {
  if (newDefaultMiniProgramId !== undefined) {
    updateDefaultMiniProgramId(newDefaultMiniProgramId);
  }
});

watch(workspace, (newWorkspace) => {
  if (newWorkspace !== undefined && newWorkspace !== null) {
    updateWorkspace(newWorkspace);
  }
});

const selectWorkspace = async () => {
  try {
    const result = await window.electronAPI.system.openDialog({
      properties: ["openDirectory", "createDirectory"],
      title: t("SETTINGS.DATA_MANAGER_SETTINGS.SELECT_WORKSPACE"),
    });
    if (!result.code || result.code !== ErrorCode.SUCCESS) {
      return;
    }
    const data = result.data as { canceled: boolean; filePaths: string[] };

    if (data && !data.canceled && data.filePaths.length > 0) {
      workspace.value = data.filePaths[0];
    }
  } catch (error) {
    logger.error("选择工作目录失败:", { error });
  }
};

const checkUpdate = async () => { };
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.settings-container {
  height: 60vh;
  padding: 10px;
  gap: 20px;
  flex-flow: nowrap !important;
}

.settings-anchor {
  width: 150px;
  flex-shrink: 0;
  padding: $spacing-md;
  border-right: 1px solid var(--border-color);
}

.anchor-link {
  justify-content: center;
  align-items: flex-end;
  margin-bottom: $spacing-md;
  font-size: $font-sm;
  height: $spacing-xl;
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.settings-card {
  margin-bottom: 10px;
}

.setting-item {
  margin-bottom: 10px;
  align-items: center;
  height: 34px;
}

.setting-label {
  width: 100px;
}

.setting-select {
  width: 200px;
  margin-left: 10px;
}

.theme-color-space {
  margin-left: 10px;
  align-items: center;
  justify-content: flex-start;
  height: 22px;
}


.setting-value-container {
  align-items: center;
  justify-content: center;
}

.setting-label-description {
  margin-left: 10px;
}
</style>
