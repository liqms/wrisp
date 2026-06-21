<template>
  <n-flex class="download-button" :class="statusClass" @click="handleClick">
    <n-flex class="download-button-content" align="center">
      <!-- 文字区域 -->
      <n-flex class="text-wrapper">
        <n-text class="title-text" :depth="isCompleted ? 3 : undefined">
          {{ title }}
        </n-text>
        <n-text v-if="desc" class="desc-text" depth="3">
          {{ desc }}
        </n-text>
      </n-flex>
      <!-- 图标区域 -->
      <n-flex class="icon-wrapper" align="center" justify="center">
        <!-- 未下载：下载图标 -->
        <n-icon v-if="isPending" :size="20" color="var(--primary-color)">
          <CloudDownloadOutline />
        </n-icon>
        <!-- 下载中：进度百分比 -->
        <n-text v-else-if="isDownloading" class="progress-text">
          {{ Math.round(progress) }}%
        </n-text>
        <!-- 下载完成：完成图标 -->
        <n-icon v-else-if="isCompleted" :size="20" color="var(--primary-color)">
          <CheckmarkCircle />
        </n-icon>
      </n-flex>


    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CloudDownloadOutline, CheckmarkCircle } from "@vicons/ionicons5";

const props = withDefaults(defineProps<{
  title: string;
  desc?: string;
  progress?: number;
  url?: string;
  localpath?: string;
}>(), {
  desc: "",
  progress: 0,
  url: "",
  localpath: "",
});

const emit = defineEmits<{
  click: [url?: string];
}>();

const isPending = computed(() => {
  return !props.localpath && (props.progress === 0 || props.progress === undefined);
});

const isDownloading = computed(() => {
  return props.progress > 0 && props.progress < 100 && !props.localpath;
});

const isCompleted = computed(() => {
  return !!props.localpath || props.progress >= 100;
});

const statusClass = computed(() => {
  if (isCompleted.value) return "status-completed";
  if (isDownloading.value) return "status-downloading";
  return "status-pending";
});

const handleClick = () => {
  emit("click", props.url);
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.download-button {
  // height: 40px !important;
  width: 300px !important;
  padding: $spacing-xs $spacing-sm !important;
  border-radius: $radius-sm;
  background-color: var(--bg-primary);
  // cursor: pointer;

  // &.status-pending {
  // border: 1px solid var(--bg-primary);

  // &:hover {
  //   border-color: var(--primary-color);
  //   transition: all 0.25s ease-in-out;
  //   box-shadow: 0 0 0 1px var(--primary-color);
  // }
  // }

  &.status-downloading {

    // border: 1px solid var(--primary-color);
    // &:hover {
    //   border-color: var(--primary-color);
    //   transition: all 0.25s ease-in-out;
    //   box-shadow: 0 0 0 1px var(--primary-color);
    // }

    .progress-text {
      font-size: $font-xs;
      color: var(--primary-color);
    }
  }

  // &.status-completed {
  //   border: 1px solid var(--primary-color);
  // }
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
  // background-color: var(--bg-secondary);
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
  // line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desc-text {
  font-size: $font-xs;
  // line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: $spacing-xs;
}
</style>
