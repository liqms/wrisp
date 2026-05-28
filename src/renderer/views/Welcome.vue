<template>
  <n-flex class="welcome-container">
    <n-scrollbar class="welcome-content">
      <n-flex class="welcome-hello">
        <n-flex class="welcome-hello-title">
          <n-icon :color="themeVars.primaryColor" size="40">
            <HeartOutline />
          </n-icon>
          <n-text class="welcome-hello-title-text">{{
            t("APP.BASE.WELCOME")
          }}</n-text>
          <n-gradient-text class="welcome-hello-title-sub" type="primary">
            PenTip!
          </n-gradient-text>
        </n-flex>
      </n-flex>
      <n-flex class="welcome-workspace">
        <n-text class="welcome-workspace-title">
          {{ t("TIPS.SETTINGS.CHOOSE_FOLDER_TITLE") }}
        </n-text>
        <n-flex class="welcome-workspace-card">
          <n-flex class="welcome-workspace-icon-wrapper">
            <n-icon class="welcome-workspace-icon" size="54">
              <Folder />
            </n-icon>
          </n-flex>
          <n-flex class="welcome-workspace-desc-wrapper">
            <n-text class="welcome-workspace-desc-title">
              {{ t("TIPS.SETTINGS.CHOOSE_FOLDER_DESC") }}
            </n-text>
            <n-text class="welcome-workspace-desc-path">{{ t("TIPS.SETTINGS.CURRENT_FOLDER") }}:&nbsp;
              {{ currentWorkspace }}</n-text>
            <n-flex class="welcome-workspace-btn" @click="selectWorkspace">
              <n-text class="welcome-workspace-btn-title">
                {{ t("TIPS.SETTINGS.CHOOSE_FOLDER") }}
              </n-text>
              <n-text class="welcome-workspace-btn-desc">
                {{ t("TIPS.SETTINGS.CHOOSE_FOLDER_DESC_2") }}
              </n-text>
            </n-flex>
          </n-flex>
        </n-flex>
      </n-flex>
    </n-scrollbar>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HeartOutline, Folder } from "@vicons/ionicons5";
import { useConfig } from "@/renderer/composables/useConfig";
import { ErrorCode } from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";
import { useI18n } from "vue-i18n";
import { useThemeVars } from "naive-ui";

const themeVars = useThemeVars();

const { t } = useI18n();
const { workspace, updateWorkspace } = useConfig();

const currentWorkspace = computed(() => {
  return workspace.value || t("TIPS.SETTINGS.NOT_SETTING");
});

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

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.welcome-container {
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 0 $spacing-md;
}

.welcome-content {
  align-items: flex-start;
  justify-content: center;
  height: 100%;
}

.welcome-hello {
  height: 120px;
  max-width: 800px;
  margin: 10px auto;
  align-items: center;
  justify-content: center;
}

.welcome-hello-title {
  font-size: $font-3xl;
  align-items: center;
  justify-content: center;
}

.welcome-workspace {
  margin: 10px auto;
  max-width: 800px;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
}

.welcome-workspace-title {
  font-size: $font-md;
  color: var(--text-secondary);
  width: 100%;
}

.welcome-workspace-card {
  align-items: center;
  margin-top: $spacing-sm;
  padding: $spacing-md;
  background-color: var(--bg-secondary);
  // border: 1px solid var(--border-color);
  border-radius: 8px;

  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  width: 100%;
}

.welcome-workspace-icon-wrapper {
  align-items: center;
  justify-content: center !important;
  height: 80px;
  width: 100px;
  flex-shrink: 0;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
}

.welcome-workspace-icon {
  color: var(--color-primary);
}

.welcome-workspace-desc-wrapper {
  margin-left: $spacing-md;
  flex-direction: column !important;
  align-items: flex-start;
  gap: $spacing-xs;
}

.welcome-workspace-desc-title {
  font-size: $font-base;
  color: var(--text-secondary);
}

.welcome-workspace-desc-path {
  font-size: $font-sm;
  color: var(--text-quaternary);
  word-break: break-all;
}

.welcome-workspace-btn {
  flex-direction: column !important;
  padding: 8px 16px;
  margin-top: $spacing-xs;
  background-color: var(--bg-primary);
  border-radius: 6px;
  gap: 0px !important;
  align-items: center;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }
}

.welcome-workspace-btn-title {
  font-size: $font-base;
  font-weight: 500;
  color: var(--color-primary);
}

.welcome-workspace-btn-desc {
  font-size: $font-xs;
  color: var(--text-quaternary);
}
</style>
