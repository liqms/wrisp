<template>
  <n-scrollbar class="general-settings card-has-scrollbar-width">
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.ABOUT_SETTINGS.CURRENT_VERSION")
          }}</n-text>
          <n-text class="setting-desc">Wrisp V{{ version }}</n-text>
          <n-text class="setting-link" @click="openUpdateRecord">{{ t("SETTINGS.GENERAL_SETTINGS.UPDATE_RECORD")
          }}</n-text>
        </n-flex>

        <n-button tertiary :loading="checkingUpdate || downloading" :disabled="downloading" class="button"
          @click="handleUpdateButtonClick">
          <template v-if="downloading">{{ t("UPDATE.DOWNLOADING", { percent: updatePercent }) }}</template>
          <template v-else-if="installed">{{ t("UPDATE.INSTALL_NOW") }}</template>
          <template v-else>{{ t("SETTINGS.ABOUT_SETTINGS.CHECK_UPDATE") }}</template>
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
        <n-select v-model:value="themeMode" :options="themeOptions" class="setting-select"
          :menu-props="{ class: 'setting-select-menu' }" />
      </n-flex>
      <n-divider />
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.GENERAL_SETTINGS.LOCALE")
          }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.GENERAL_SETTINGS.SELECT_LOCALE_DESC") }}</n-text>
        </n-flex>
        <n-select v-model:value="locale" :options="localeOptions" class="setting-select"
          :menu-props="{ class: 'setting-select-menu' }" />
      </n-flex>
      <n-divider />
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.GENERAL_SETTINGS.JOURNAL_DATE_FORMAT")
          }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.GENERAL_SETTINGS.JOURNAL_DATE_FORMAT_DESC") }}</n-text>
        </n-flex>
        <n-select v-model:value="journalDateFormat" :options="dateFormatOptions" class="setting-select"
          :menu-props="{ class: 'setting-select-menu' }" />
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
          :menu-props="{ class: 'setting-select-menu' }" @update:value="onProfessionChange" />
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
        <n-button tertiary size="medium" class="button" @click="selectWorkspace">
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
        <n-button tertiary size="medium" class="button" :loading="rebuildingIndex" :disabled="rebuildingIndex"
          @click="rebuildIndex">
          {{ t("SETTINGS.DATA_MANAGER_SETTINGS.REBUILD_INDEX") }}
        </n-button>
      </n-flex>
    </n-card>

    <UpdatePrompt v-model:visible="updateVisible" :version="updateVersion" :release-notes="updateNotes"
      :downloading="downloading" :percent="updatePercent" :installed="installed" @update="handleUpdate"
      @later="handleLater" @install="handleInstall" />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { AppConfig } from "@/shared/types";
import { useConfig } from "@/renderer/composables/useConfig";
import { useJournal } from "@/renderer/composables/useJournal";
import { useProject } from "@/renderer/composables/useProject";
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
const { resetProjectTable } = useProject();
const rebuildingIndex = ref(false);
const configStore = useConfig();
const {
  version,
  workspace,
  themeMode: configThemeMode,
  themeColor,
  locale: configLocale,
  profession: configProfession,
  journalDateFormat: configJournalDateFormat,
  updateThemeMode,
  updateLocale,
  updateThemeColor,
  updateJournalDateFormat,
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

const journalDateFormat = ref<string>("yyyy-MM-dd");

const dateFormatOptions = [
  { label: "E, MM/dd/yyyy", value: "E, MM/dd/yyyy" },
  { label: "E, dd-MM-yyyy", value: "E, dd-MM-yyyy" },
  { label: "E, dd.MM.yyyy", value: "E, dd.MM.yyyy" },
  { label: "E, yyyy/MM/dd", value: "E, yyyy/MM/dd" },
  { label: "EEE, MM/dd/yyyy", value: "EEE, MM/dd/yyyy" },
  { label: "EEE, dd-MM-yyyy", value: "EEE, dd-MM-yyyy" },
  { label: "EEE, dd.MM.yyyy", value: "EEE, dd.MM.yyyy" },
  { label: "EEE, yyyy/MM/dd", value: "EEE, yyyy/MM/dd" },
  { label: "EEEE, MM/dd/yyyy", value: "EEEE, MM/dd/yyyy" },
  { label: "EEEE, dd-MM-yyyy", value: "EEEE, dd-MM-yyyy" },
  { label: "EEEE, dd.MM.yyyy", value: "EEEE, dd.MM.yyyy" },
  { label: "EEEE, yyyy/MM/dd", value: "EEEE, yyyy/MM/dd" },
  { label: "MM-dd-yyyy", value: "MM-dd-yyyy" },
  { label: "MM/dd/yyyy", value: "MM/dd/yyyy" },
  { label: "MMM do, yyyy", value: "MMM do, yyyy" },
  { label: "MMMM do, yyyy", value: "MMMM do, yyyy" },
  { label: "MM_dd_yyyy", value: "MM_dd_yyyy" },
  { label: "dd-MM-yyyy", value: "dd-MM-yyyy" },
  { label: "do MMM yyyy", value: "do MMM yyyy" },
  { label: "do MMMM yyyy", value: "do MMMM yyyy" },
  { label: "yyyy-MM-dd", value: "yyyy-MM-dd" },
  { label: "yyyy-MM-dd EEEE", value: "yyyy-MM-dd EEEE" },
  { label: "yyyy/MM/dd", value: "yyyy/MM/dd" },
  { label: "yyyyMMdd", value: "yyyyMMdd" },
  { label: "yyyy_MM_dd", value: "yyyy_MM_dd" },
  { label: "yyyy年MM月dd日", value: "yyyy年MM月dd日" },
];

onMounted(() => {
  journalDateFormat.value = configJournalDateFormat.value;
});

watch(journalDateFormat, (newVal) => {
  if (newVal && newVal !== configJournalDateFormat.value) {
    logger.debug("更新日志日期格式", { newDateFormat: newVal });
    updateJournalDateFormat(newVal);
  }
});

const profession = ref<Profession>(configProfession.value);

const professionOptions = (Object.values(PROFESSION) as Profession[])
  // GENERAL 与 CUSTOM 为模板归类标签，不作为用户可选职业
  .filter(
    (value) =>
      value !== PROFESSION.GENERAL && value !== PROFESSION.CUSTOM,
  )
  .map((value) => ({
    label: t(`SETTINGS.PROFESSION.OPTION_${value.toUpperCase()}`),
    value,
  }));

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
window.electronAPI.update.onEvent("available", (payload: unknown) => {
  const info = payload as { version: string; releaseNotes?: string };
  updateVersion.value = info.version;
  updateNotes.value = info.releaseNotes ?? "";
  updateVisible.value = true;
});
window.electronAPI.update.onEvent("download-progress", (payload: unknown) => {
  const progress = payload as { percent: number };
  downloading.value = true;
  updatePercent.value = Math.round(progress.percent);
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
  } catch {
    downloading.value = false;
    message.error(t("UPDATE.CHECK_FAILED"));
  }
};

const handleInstall = (): void => {
  window.electronAPI.update.install();
};

// 更新按钮点击：已下载则触发安装，否则执行检查更新（下载中按钮禁用不可点击）
const handleUpdateButtonClick = (): void => {
  if (installed.value) {
    handleInstall();
    return;
  }
  void checkUpdate();
};

// 稍后再说：仅关闭弹窗，下次检查时重新提示
const handleLater = (): void => {
  updateVisible.value = false;
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
    const [journalCount, projectResult] = await Promise.all([
      resetJournalTable(),
      resetProjectTable(),
    ]);
    message.success(
      t("SETTINGS.DATA_MANAGER_SETTINGS.REBUILD_INDEX_SUCCESS", {
        journals: journalCount,
        projects: projectResult?.projects ?? 0,
        pages: projectResult?.pages ?? 0,
      }),
    );
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
      title: t("ACTION.SELECT.SELECT_WORKSPACE"),
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
  width: fit-content;
  min-width: 100px;
  max-width: 230px;
  flex-shrink: 0;
}

.theme-color-space {
  align-items: center;
  justify-content: flex-start;
}
</style>

<style lang="scss">
/* 下拉弹出菜单渲染在 body 下（teleport），需非 scoped 样式；
   通过 menu-props 传入的类名限定，使菜单宽度自适应最长选项 */
.setting-select-menu {
  min-width: max-content;
}
</style>
