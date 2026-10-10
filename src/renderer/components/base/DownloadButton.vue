<template>
  <n-flex class="download-button" :class="`status-${status}`" @click="emit('click')">
    <n-flex class="download-button-content" align="center">
      <!-- 文字区域 -->
      <n-flex class="text-wrapper">
        <n-text class="title-text" :depth="status === 'completed' ? 3 : undefined">
          {{ title }}
        </n-text>
        <n-text v-if="statusText || desc" class="desc-text"
          :class="{ 'desc-text--failed': status === 'failed' }" depth="3">
          {{ statusText || desc }}
        </n-text>
      </n-flex>
      <!-- 图标区域 -->
      <n-flex class="icon-wrapper" align="center" justify="center">
        <!-- 未下载：下载图标 -->
        <n-icon v-if="status === 'pending'" :size="20" color="var(--primary-color)">
          <CloudDownloadOutline />
        </n-icon>
        <!-- 下载中：进度百分比 -->
        <n-text v-else-if="status === 'downloading'" class="progress-text">
          {{ Math.round(progress) }}%
        </n-text>
        <!-- 下载完成：完成图标 -->
        <n-icon v-else-if="status === 'completed'" :size="20" color="var(--primary-color)">
          <CheckmarkCircle />
        </n-icon>
        <!-- 下载失败 -->
        <n-icon v-else-if="status === 'failed'" :size="20" color="var(--error-color)">
          <AlertCircleOutline />
        </n-icon>
        <!-- 已取消 -->
        <n-icon v-else :size="20" color="var(--text-third)">
          <CloseCircleOutline />
        </n-icon>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  AlertCircleOutline,
  CheckmarkCircle,
  CloseCircleOutline,
  CloudDownloadOutline,
} from "@vicons/ionicons5";
import type { ModelDownloadStatus } from "@/renderer/utils/model-download-status";

const props = withDefaults(defineProps<{
  title: string;
  desc?: string;
  /** 由调用方聚合出的状态；组件不再从 progress/localpath 猜测 */
  status?: ModelDownloadStatus;
  progress?: number;
}>(), {
  desc: "",
  status: "pending",
  progress: 0,
});

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n();

/** 失败/取消时描述行改为可操作的提示，此时体积信息没有意义 */
const statusText = computed(() => {
  if (props.status === "failed") return t("MODELS.DOWNLOAD_FAILED");
  if (props.status === "cancelled") return t("MODELS.DOWNLOAD_CANCELLED");
  return "";
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.download-button {
  padding: $spacing-xs $spacing-sm !important;
  border-radius: $radius-sm;
  background-color: var(--bg-primary);

  &.status-downloading {
    .progress-text {
      font-size: $font-xs;
      color: var(--primary-color);
    }
  }
}

.download-button-content {
  width: 100%;
  gap: $spacing-sm !important;
}

.icon-wrapper {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: $radius-md;
  margin-left: $spacing-sm;
}

.text-wrapper {
  flex: 1;
  gap: 2px !important;
  min-width: 0;
  text-align: left;
  margin-left: $spacing-xs;
  align-items: center;
}

.title-text {
  font-size: $font-xs;
  color: var(--text-third);
  font-weight: $font-medium;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc-text {
  font-size: $font-xs;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: $spacing-xs;

  &--failed {
    color: var(--error-color);
  }
}
</style>
