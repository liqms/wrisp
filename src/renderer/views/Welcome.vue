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
            Wrisp!
          </n-gradient-text>
        </n-flex>
        <n-text class="welcome-hello-desc">
          {{ t("APP.BASE.WELCOME_DESC") }}
        </n-text>
      </n-flex>
      <n-flex class="welcome-features-wrapper">
        <FeatureCard v-for="feature in features" :key="feature.title" :icon="feature.icon" :title="feature.title"
          :desc="feature.desc" />
      </n-flex>
      <n-flex class="welcome-workspace">
        <n-text class="welcome-workspace-title">
          {{ t("SETTINGS.GENERAL_SETTINGS.CHOOSE_FOLDER_TITLE") }}
        </n-text>
        <n-flex class="welcome-workspace-card">
          <n-flex class="welcome-workspace-icon-wrapper">
            <n-icon :color="iconColor" size="54">
              <Folder />
            </n-icon>
          </n-flex>
          <n-flex class="welcome-workspace-desc-wrapper">
            <n-text class="welcome-workspace-desc-title">
              {{ t("SETTINGS.GENERAL_SETTINGS.CHOOSE_FOLDER_DESC") }}
            </n-text>
            <n-text class="welcome-workspace-desc-path">{{ t("SETTINGS.GENERAL_SETTINGS.CURRENT_FOLDER") }}:&nbsp;
              {{ currentWorkspace }}</n-text>
            <n-flex class="welcome-workspace-btn" :style="{ backgroundColor: buttonBgColor }" @click="selectWorkspace">
              <n-text class="welcome-workspace-btn-title">
                {{ t("SETTINGS.GENERAL_SETTINGS.CHOOSE_FOLDER") }}
              </n-text>
              <n-text class="welcome-workspace-btn-desc">
                {{ t("SETTINGS.GENERAL_SETTINGS.CHOOSE_FOLDER_DESC_2") }}
              </n-text>
            </n-flex>
          </n-flex>
        </n-flex>
      </n-flex>
      <n-flex class="welcome-enable-ai-mode">
        <n-flex class="welcome-enable-ai-mode-header" align="center" justify="space-between">
          <n-text class="welcome-enable-ai-mode-title">
            {{ t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE_TITLE") }}
          </n-text>
        </n-flex>

        <n-flex class="welcome-enable-ai-mode-card">
          <n-flex class="welcome-enable-ai-mode-icon-wrapper">
            <n-icon :color="iconColor" size="54">
              <Cube />
            </n-icon>
          </n-flex>
          <n-flex class="welcome-enable-ai-mode-desc-wrapper">
            <n-flex class="welcome-enable-ai-mode-desc-content-wrapper">
              <n-flex class="welcome-enable-ai-mode-desc-title-wrapper">
                <n-text class="welcome-enable-ai-mode-desc-title">
                  {{ t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE_DESC") }}
                </n-text>
                <n-text class="welcome-enable-ai-mode-desc-path">{{ t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE_DESC_2") }}
                </n-text>
              </n-flex>
              <n-switch :value="enableAiMode" :loading="switching" @update:value="handleToggleAiMode" />
            </n-flex>
            <n-flex v-if="enableAiMode" class="welcome-enable-ai-mode-desc-item">
              <DownloadButton v-for="model in modelList" :key="model.id" :title="model.label" :desc="model.desc"
                :progress="model.progress" :localpath="model.localpath" />
            </n-flex>
          </n-flex>
        </n-flex>
      </n-flex>
    </n-scrollbar>
  </n-flex>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import {
  CreateOutline,
  BulbOutline,
  LayersOutline,
  NuclearOutline,
  Folder,
  HeartOutline,
  Cube,
} from "@vicons/ionicons5";
import { useConfig } from "@/renderer/composables/useConfig";
import { useModel } from "@/renderer/composables/useModel";
import { useDownloadStore } from "@/renderer/store/download.store";
import { ErrorCode } from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";
import { useI18n } from "vue-i18n";
import { useThemeVars } from "naive-ui";
import FeatureCard from "@/renderer/components/base/FeatureCard.vue";
import DownloadButton from "@/renderer/components/base/DownloadButton.vue";
import { hexToRgb } from "@/shared/enums/themeColor.enums";

const themeVars = useThemeVars();
const buttonBgColor = computed(() => hexToRgb(themeVars.value.primaryColor, 0.1));
const iconColor = computed(() => hexToRgb(themeVars.value.primaryColor, 0.5));

const { t } = useI18n();
const { workspace, updateWorkspace } = useConfig();
const {
  enableAiMode,
  updateEnableAiMode,
  checkModelExist,
} = useModel();

const currentWorkspace = computed(() => {
  return workspace.value || t("SETTINGS.NOT_SETTING");
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

const features = computed(() => [
  {
    icon: CreateOutline,
    title: t("APP.BASE.FEATURES_1_TITLE"),
    desc: t("APP.BASE.FEATURES_1_DESC"),
  },
  {
    icon: NuclearOutline,
    title: t("APP.BASE.FEATURES_2_TITLE"),
    desc: t("APP.BASE.FEATURES_2_DESC"),
  },
  {
    icon: BulbOutline,
    title: t("APP.BASE.FEATURES_3_TITLE"),
    desc: t("APP.BASE.FEATURES_3_DESC"),
  },
  {
    icon: LayersOutline,
    title: t("APP.BASE.FEATURES_4_TITLE"),
    desc: t("APP.BASE.FEATURES_4_DESC"),
  },
]);

// 模型定义（与后端 model-registry.ts 保持一致）
const MODEL_DEFS = [
  { id: "jina-embeddings-v3", labelKey: "MODELS.EMBEDDINGS", descKey: "MODELS.EMBEDDINGS_DESC" },
  { id: "bge-reranker-v2-m3", labelKey: "MODELS.RERANKER", descKey: "MODELS.RERANKER_DESC" },
] as const;

const downloadStore = useDownloadStore();
// 模型下载状态（从后端查询）
const modelExistStatus = ref<Record<string, boolean>>({});
const loadingModelStatus = ref(false);

// 切换 AI 模式
const switching = ref(false);

async function handleToggleAiMode(value: boolean) {
  switching.value = true;
  try {
    await updateEnableAiMode(value);
    if (value) {
      await refreshModelStatus();
    }
  } finally {
    switching.value = false;
  }
}

// 刷新模型下载状态
async function refreshModelStatus() {
  loadingModelStatus.value = true;
  try {
    const result = await checkModelExist();
    if (result) {
      modelExistStatus.value = result;
    }
  } finally {
    loadingModelStatus.value = false;
  }
}

// 模型列表（合并后端状态和下载进度）
const modelList = computed(() => {
  return MODEL_DEFS.map((def) => {
    const exists = modelExistStatus.value[def.id];
    // 从 downloadStore 查找该模型的下载进度
    let progress = 0;
    let localpath = exists ? "downloaded" : "";

    // 遍历所有下载组，查找匹配的文件
    for (const group of downloadStore.allGroupsProgress) {
      if (!group) continue;
      for (const file of group.files) {
        if (file.url.includes(def.id)) {
          progress = file.progress;
          if (file.status === "completed") {
            localpath = file.localPath || "downloaded";
          }
          break;
        }
      }
    }

    return {
      id: def.id,
      label: t(def.labelKey),
      desc: t(def.descKey),
      progress,
      localpath,
    };
  });
});


// 初始化：加载模型状态
onMounted(async () => {
  if (enableAiMode.value) {
    await refreshModelStatus();
  }
});

// 监听 enableAiMode 变化，开启时刷新状态
watch(enableAiMode, (val) => {
  if (val) {
    refreshModelStatus();
  }
});
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
  height: fit-content;
  max-width: 800px;
  margin: 10px auto;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl 0;
}

.welcome-hello-title {
  font-size: $font-3xl;
  align-items: center;
  justify-content: center;
}

.welcome-hello-title-text {
  color: var(--text-third);
}

.welcome-hello-desc {
  font-size: $font-base;
  color: var(--text-third);
  width: 100%;
  margin-top: $spacing-md;
}

.welcome-features-wrapper {
  height: fit-content;
  max-width: 800px;
  margin: 10px auto;
  align-items: center;
  justify-content: space-between !important;
}

.welcome-workspace,
.welcome-enable-ai-mode {
  margin: $spacing-xl auto;
  max-width: 800px;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
}

.welcome-enable-ai-mode-header {
  width: 100%;
}

.welcome-workspace-title,
.welcome-enable-ai-mode-title {
  font-size: $font-md;
  color: var(--text-secondary);
  width: 100%;
  font-weight: $font-medium;
}

.welcome-workspace-card,
.welcome-enable-ai-mode-card {
  align-items: center;
  margin-top: $spacing-sm;
  padding: $spacing-lg $spacing-md;
  background-color: var(--bg-secondary);
  border-radius: 8px;

  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  width: 100%;
}

.welcome-workspace-icon-wrapper,
.welcome-enable-ai-mode-icon-wrapper {
  align-items: center;
  justify-content: center !important;
  height: 80px;
  width: 100px;
  flex-shrink: 0;
  border-radius: 8px;
}

.welcome-workspace-icon,
.welcome-enable-ai-mode-icon {
  color: var(--primary-color);
}

.welcome-workspace-desc-wrapper,
.welcome-enable-ai-mode-desc-wrapper {
  margin-left: $spacing-md;
  flex-direction: column !important;
  align-items: flex-start;
  gap: $spacing-xs;
  max-width: 640px;
}

.welcome-enable-ai-mode-desc-content-wrapper {
  flex-direction: row !important;
  align-items: center;
  gap: $spacing-xs;
}

.welcome-enable-ai-mode-desc-title-wrapper {
  max-width: calc(100% - 80px);
}

.welcome-workspace-desc-title,
.welcome-enable-ai-mode-desc-title {
  font-size: $font-base;
  color: var(--text-secondary);
}

.welcome-enable-ai-mode-desc-path,
.welcome-workspace-desc-path {
  font-size: $font-sm;
  color: var(--text-quaternary);
  word-break: break-all;
}

.welcome-enable-ai-mode-desc-item {
  display: flex;
  align-items: center;
  margin-top: $spacing-xs;
}

.welcome-workspace-btn {
  flex-direction: column !important;
  padding: $spacing-md;
  margin-top: $spacing-xs;
  // background-color: var(--bg-primary);
  border-radius: $radius-md;
  gap: 0px !important;
  align-items: center;
  cursor: pointer;

  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-color);
    transition: all 0.25s ease-in-out;
  }
}

.welcome-workspace-btn-title {
  font-size: $font-base;
  font-weight: $font-medium;
  color: var(--text-third);
}

.welcome-workspace-btn-desc {
  font-size: $font-xs;
  color: var(--text-quaternary);
}

// 响应式布局
@media (max-width: $breakpoint-lg) {

  .welcome-workspace-icon-wrapper,
  .welcome-enable-ai-mode-icon-wrapper {
    display: none !important;
  }
}
</style>