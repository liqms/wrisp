<template>
  <n-scrollbar class="general-settings">
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.ABOUT_SETTINGS.CURRENT_VERSION")
            }}</n-text>
          <n-text class="setting-desc">Wrisp V{{ version }}</n-text>
          <n-text class="setting-link" @click="openUpdateRecord">{{ t("SETTINGS.GENERAL_SETTINGS.UPDATE_RECORD") }}</n-text>
        </n-flex>

        <n-button type="primary" :loading="checkingUpdate" @click="checkUpdate">
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
          <n-text class="setting-label">{{
            t("SETTINGS.PROFESSION.LABEL")
          }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.PROFESSION.DESC") }}</n-text>
        </n-flex>
        <n-select :value="profession" :options="professionOptions" class="setting-select"
          @update:value="onProfessionChange" />
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
      <n-divider />
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.DATA_MANAGER_SETTINGS.REBUILD_INDEX")
            }}</n-text>
          <n-text class="setting-desc">{{
            t("SETTINGS.DATA_MANAGER_SETTINGS.REBUILD_INDEX_DESC")
            }}</n-text>
        </n-flex>
        <n-button size="medium" type="primary" :loading="rebuildingIndex" :disabled="rebuildingIndex"
          @click="rebuildIndex">
          {{ t("SETTINGS.DATA_MANAGER_SETTINGS.REBUILD_INDEX") }}
        </n-button>
      </n-flex>
    </n-card>

    <UpdatePrompt
      v-model:visible="updateVisible"
      :version="updateVersion"
      :release-notes="updateNotes"
      :downloading="downloading"
      :percent="updatePercent"
      :installed="installed"
      @update="handleUpdate"
      @install="handleInstall"
    />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { AppConfig } from "@/shared/types";
import { useConfig } from "@/renderer/composables/useConfig";
import { useJournal } from "@/renderer/composables/useJournal";
import { useMessage } from "naive-ui";
import ColorCard from "@/renderer/components/base/ColorCard.vue";
import UpdatePrompt from "@/renderer/components/UpdatePrompt.vue";
import { setLocale } from "@/renderer/plugins/i18n";
import { RELEASES_URL } from "@/main/constants";
import {
  THEME_MODE,
  LOCALE,
  ErrorCode,
  PROFESSION,
  getThemeThemePrimaryColor,
  type ThemeMode,
  type Profession,
} from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";

defineProps<{ config: AppConfig | null }>();

const { t } = useI18n();
const message = useMessage();
const { resetJournalTable } = useJournal();
const rebuildingIndex = ref(false);
const configStore = useConfig();
const {
  version,
  workspace,
  themeMode: configThemeMode,
  themeColor,
  locale: configLocale,
  profession: configProfession,
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

const profession = ref<Profession>(configProfession.value);

const professionOptions = [
  { label: t("SETTINGS.PROFESSION.OPTION_PM"), value: PROFESSION.PM },
];

const onProfessionChange = async (value: Profession) => {
  if (value === profession.value) return;
  profession.value = value;
  try {
    await configStore.setValue("userInfo.preferences.profession", value);
    message.success(t("SETTINGS.PROFESSION.SAVED"));
  } catch (error) {
    logger.error("更新职业失败", { error });
    message.error(t("ERROR.COMMON.ACTION_ERROR"));
  }
};

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

// ===== 更新功能状态 =====
const checkingUpdate = ref(false);
const updateVisible = ref(false);
const updateVersion = ref("");
const updateNotes = ref("");
const updatePercent = ref(0);
const downloading = ref(false);
const installed = ref(false);

const checkUpdate = async (): Promise<void> => {
  if (checkingUpdate.value) return;
  checkingUpdate.value = true;
  try {
    const hasUpdate = await window.electronAPI.update.check();
    if (!hasUpdate) {
      message.success(t("UPDATE.NO_UPDATE"));
      return;
    }
    // 更新可用后，主进程会广播 update:available，由下方监听填充版本信息并打开弹窗
  } catch (error) {
    logger.error("检查更新失败", { error });
    message.error(t("UPDATE.CHECK_FAILED"));
  } finally {
    checkingUpdate.value = false;
  }
};

// 订阅更新事件（可用/进度/下载完成/错误）
window.electronAPI.update.onEvent("available", (info: { version: string; releaseNotes?: string }) => {
  updateVersion.value = info.version;
  updateNotes.value = info.releaseNotes ?? "";
  updateVisible.value = true;
});
window.electronAPI.update.onEvent("download-progress", (payload: { percent: number }) => {
  downloading.value = true;
  updatePercent.value = Math.round(payload.percent);
});
window.electronAPI.update.onEvent("downloaded", () => {
  downloading.value = false;
  installed.value = true;
  message.success(t("UPDATE.DOWNLOADED"));
});
window.electronAPI.update.onEvent("error", () => {
  downloading.value = false;
  message.error(t("UPDATE.CHECK_FAILED"));
});

const handleUpdate = async (): Promise<void> => {
  try {
    await window.electronAPI.update.download();
  } catch (error) {
    downloading.value = false;
    message.error(t("UPDATE.CHECK_FAILED"));
  }
};

const handleInstall = (): void => {
  window.electronAPI.update.install();
};

const openUpdateRecord = async (): Promise<void> => {
  try {
    await window.electronAPI.system.openExternal(RELEASES_URL);
  } catch (error) {
    logger.error("打开更新记录失败", { error });
  }
};

const rebuildIndex = async () => {
  if (rebuildingIndex.value) return;
  rebuildingIndex.value = true;
  try {
    const count = await resetJournalTable();
    message.success(t("SETTINGS.DATA_MANAGER_SETTINGS.REBUILD_INDEX_SUCCESS", { count }));
  } catch (error) {
    logger.error("重建索引失败", { error });
    message.error(t("ERROR.COMMON.ACTION_ERROR"));
  } finally {
    rebuildingIndex.value = false;
  }
};

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
@use "@/renderer/styles/_variables.scss" as *;

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
