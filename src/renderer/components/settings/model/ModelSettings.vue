<template>
  <n-scrollbar class="model-settings card-has-scrollbar-width">
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE")
          }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE_DESC") }}{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_MODE_DESC_3")
          }}</n-text>
        </n-flex>
        <n-switch :value="enableAiMode" class="setting-switch" @update:value="updateEnableAiMode" />
      </n-flex>
      <n-flex v-if="enableAiMode" class="models-item">
        <DownloadButton v-for="model in modelRows" :key="model.modelId" :title="model.label" :desc="model.desc"
          :status="model.status" :progress="model.progress" @click="downloadModelFiles(model.family)" />
      </n-flex>
    </n-card>
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_CLOUD")
          }}</n-text>
          <n-text class="setting-desc">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_AI_CLOUD_DESC_3")
          }}</n-text>
        </n-flex>
        <n-switch :value="enableCloudAi" class="setting-switch" @update:value="updateEnableCloudAi" />
      </n-flex>
    </n-card>
    <!-- GPU 加速：仅作用于本地 LLM；开关只是授权，实际是否上卡由主进程显存闸门判定 -->
    <n-card v-if="enableAiMode" size="medium" :bordered="false" class="setting-card">
      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_GPU_ACCELERATION")
          }}</n-text>
          <n-text class="setting-desc">{{
            t("SETTINGS.AI_SETTINGS.ENABLE_GPU_ACCELERATION_DESC")
          }}</n-text>
          <n-text v-if="gpuStatusText" class="setting-desc gpu-status">{{ gpuStatusText }}</n-text>
        </n-flex>
        <n-switch :value="enableGpuAcceleration" class="setting-switch" @update:value="handleGpuToggle" />
      </n-flex>
    </n-card>
    <!-- 云端增强下的本地模型使用范围：默认云端优先，可逐个指定走本地 -->
    <n-card v-if="enableCloudAi" size="medium" :bordered="false" class="setting-card">
      <n-flex align="center" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{
            t("SETTINGS.AI_SETTINGS.LOCAL_LLM_TASKS")
          }}</n-text>
          <n-text class="setting-desc">{{
            t("SETTINGS.AI_SETTINGS.LOCAL_LLM_TASKS_DESC")
          }}</n-text>
        </n-flex>
      </n-flex>
      <n-flex vertical class="local-task-list">
        <n-checkbox v-for="task in LLM_TASK_DEFS" :key="task.value" :checked="localLlmTasks.includes(task.value)"
          :disabled="!enableAiMode" @update:checked="(checked: boolean) => toggleLocalTask(task.value, checked)">
          {{ t(task.labelKey) }}
        </n-checkbox>
      </n-flex>
    </n-card>
    <n-card v-if="enableCloudAi" size="medium" :bordered="false" class="setting-card nav-card clickable"
      @click="emit('navigate', PAGE_PROVIDERS)">
      <!-- 模型服务商 -->
      <n-flex class="setting-nav-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.PROVIDER_MODELS") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.PROVIDER_MODELS_DESC") }}</n-text>
        </n-flex>
        <n-icon class="nav-arrow">
          <ChevronForward />
        </n-icon>
      </n-flex>
    </n-card>
    <!-- 通用默认模型 -->
    <n-card v-if="enableCloudAi" size="medium" :bordered="false" class="setting-card nav-card clickable"
      @click="emit('navigate', PAGE_DEFAULTS)">
      <n-flex class="setting-nav-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.DEFAULT_MODEL") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.DEFAULT_MODEL_DESC") }}</n-text>
        </n-flex>
        <n-icon class="nav-arrow">
          <ChevronForward />
        </n-icon>
      </n-flex>
    </n-card>
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useModel } from "@/renderer/composables";
import { useModelDownloads } from "@/renderer/composables/useModelDownloads";
import { ChevronForward } from "@vicons/ionicons5";
import DownloadButton from "../../base/DownloadButton.vue";
import { toggleLocalLlmTask } from "@/renderer/utils/local-llm-tasks";
import type { GpuCapability } from "@/shared/types/model.types";

const PAGE_PROVIDERS = "model.providers";
const PAGE_DEFAULTS = "model.defaults";

const emit = defineEmits<{
  (e: "navigate", pageKey: string): void;
}>();

const { t } = useI18n();
const {
  config,
  enableAiMode,
  enableCloudAi,
  updateEnableAiMode,
  updateEnableCloudAi,
  setValue,
  enableGpuAcceleration,
  updateEnableGpuAcceleration,
  getGpuCapability,
} = useModel();

// 本地模型清单与下载状态（清单来自主进程，状态由磁盘检查 + 下载事件流合并）
const {
  rows: modelRows,
  refresh: refreshModelStatus,
  download: downloadModelFiles,
} = useModelDownloads();

/** GPU 能力快照；null = 尚未探测（开关关闭时恒为 null） */
const gpuCapability = ref<GpuCapability | null>(null);
const gpuChecking = ref(false);

/** 切换 GPU 开关：关闭时清空快照，开启时才向后端要一次探测结果 */
async function handleGpuToggle(enable: boolean): Promise<void> {
  const updated = await updateEnableGpuAcceleration(enable);
  if (!updated) return;
  if (!enable) {
    gpuCapability.value = null;
    return;
  }
  await refreshGpuCapability();
}

/** 拉取 GPU 能力快照（首次会触发主进程显存探测，可能耗时） */
async function refreshGpuCapability(): Promise<void> {
  gpuChecking.value = true;
  try {
    gpuCapability.value = await getGpuCapability();
  } finally {
    gpuChecking.value = false;
  }
}

/** 开关下方的提示行：告诉用户「开了也不一定用上」的原因 */
const gpuStatusText = computed(() => {
  if (!enableGpuAcceleration.value) return "";
  if (gpuChecking.value) return t("SETTINGS.AI_SETTINGS.GPU_CHECKING");

  const cap = gpuCapability.value;
  if (!cap || !cap.probed) return t("SETTINGS.AI_SETTINGS.GPU_UNKNOWN");
  if (cap.usable) {
    return t("SETTINGS.AI_SETTINGS.GPU_DETECTED", {
      devices: cap.deviceNames.join(" / "),
      total: cap.totalVramGB,
      free: cap.freeVramGB,
    });
  }
  if (cap.deviceNames.length === 0) return t("SETTINGS.AI_SETTINGS.GPU_NONE");
  if (cap.reason === "insufficient-vram") {
    return t("SETTINGS.AI_SETTINGS.GPU_VRAM_SHORT", {
      devices: cap.deviceNames.join(" / "),
      free: cap.freeVramGB,
      need: cap.requiredVramGB,
    });
  }
  return t("SETTINGS.AI_SETTINGS.GPU_CPU_FALLBACK");
});

/** 可指定「走本地」的 3 个 LLM 任务（与后端 TASK_LLM_TASK_TYPE 对应） */
const LLM_TASK_DEFS = [
  { value: "summary", labelKey: "SETTINGS.AI_SETTINGS.LOCAL_LLM_TASK_SUMMARY" },
  {
    value: "concept_naming",
    labelKey: "SETTINGS.AI_SETTINGS.LOCAL_LLM_TASK_CONCEPT",
  },
  {
    value: "topic_summary",
    labelKey: "SETTINGS.AI_SETTINGS.LOCAL_LLM_TASK_TOPIC",
  },
] as const;

type LlmTaskType = (typeof LLM_TASK_DEFS)[number]["value"];

/** 已勾选「走本地」的任务类型 */
const localLlmTasks = computed<LlmTaskType[]>(
  () => (config.value?.localLlmTasks ?? []) as LlmTaskType[],
);

/** 切换某任务的「走本地」勾选并持久化 */
async function toggleLocalTask(
  task: LlmTaskType,
  checked: boolean,
): Promise<void> {
  await setValue(
    "localLlmTasks",
    toggleLocalLlmTask(localLlmTasks.value, task, checked),
  );
}

// 初始化：加载模型状态
onMounted(async () => {
  if (enableAiMode.value) {
    await refreshModelStatus();
    // 开关此前已打开：取回能力快照展示（快照在后端缓存，不会重复探测）
    if (enableGpuAcceleration.value) {
      await refreshGpuCapability();
    }
  }
});

// 监听 enableAiMode 变化，开启时刷新状态
watch(enableAiMode, (val) => {
  if (val) {
    refreshModelStatus();
  }
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.model-settings {
  max-height: 100%;
}

.setting-card {
  margin-bottom: $spacing-md;
  background-color: var(--bg-secondary);
  border-radius: $radius-md;
}

.ai-mode-list {
  gap: 12px;
  flex-wrap: wrap;
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
  max-width: calc(100% - 100px);
}

.setting-label {
  font-size: $font-base;
}

.setting-desc {
  font-size: $font-xs;
  color: var(--text-third);
}

.models-item {
  display: flex;
  align-items: center;
  margin-top: $spacing-xs;
}

.setting-nav-row {
  align-items: center;
  justify-content: space-between !important;
}

.nav-arrow {
  color: var(--text-third);
  flex-shrink: 0;
}

.local-task-list {
  gap: 8px;
  margin-top: $spacing-xs;
}

.gpu-status {
  margin-top: $spacing-xs;
}
</style>