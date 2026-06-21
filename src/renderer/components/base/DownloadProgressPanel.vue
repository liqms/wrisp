<template>
  <div class="download-progress-panel">
    <n-list v-for="group in allGroups" :key="group?.groupId" class="group-list">
      <template #header>
        <n-flex align="center" justify="space-between">
          <n-text class="group-title">{{ t('DOWNLOAD.GROUP_TITLE') }}</n-text>
          <n-text class="group-summary" depth="3">
            {{ group?.completed }}/{{ group?.total }} | {{ group?.avgProgress }}%
          </n-text>
        </n-flex>
      </template>

      <n-list-item v-for="file in group?.files" :key="file.taskId" class="file-item">
        <n-flex vertical class="file-info">
          <n-flex align="center" justify="space-between">
            <n-ellipsis class="file-name" :line-clamp="1">
              {{ file.fileName || file.url.split('/').pop() }}
            </n-ellipsis>
            <n-text :class="statusClass(file)" class="file-status" depth="3">
              {{ file.progress }}%
            </n-text>
          </n-flex>
          <n-progress v-if="file.status === 'downloading' || file.status === 'pending'" :percentage="file.progress"
            :show-indicator="false" :height="4" :processing="file.status === 'downloading'" type="line"
            color="var(--primary-color)" />
        </n-flex>
      </n-list-item>
    </n-list>

    <n-flex v-if="allDone" class="panel-footer" align="center" justify="center">
      <n-text depth="3" class="done-text">
        {{ t('DOWNLOAD.COMPLETED') }}
      </n-text>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDownloadStore } from "@/renderer/store/download.store";
import type { DownloadProgress } from "@/main/types/download.types";

const { t } = useI18n();
const downloadStore = useDownloadStore();

const allGroups = computed(() => downloadStore.allGroupsProgress);
const allDone = computed(
  () =>
    allGroups.value.length > 0 &&
    allGroups.value.every((g) => g?.isDone),
);

// 当所有下载完成时，发送通知到前端
watch(allDone, (done) => {
  if (done) {
    const totalCompleted = allGroups.value.reduce(
      (sum, g) => sum + (g?.completed ?? 0),
      0,
    );
    const totalFailed = allGroups.value.reduce(
      (sum, g) => sum + (g?.failed ?? 0),
      0,
    );

    window.electronAPI.send?.("app:notification", {
      level: totalFailed === 0 ? "success" : "warning",
      title: t("DOWNLOAD.TITLE"),
      content:
        totalFailed === 0
          ? t("NOTIFICATION.MODEL_DOWNLOAD_SUCCESS")
          : t("NOTIFICATION.MODEL_DOWNLOAD_PARTIAL", {
            completed: totalCompleted,
            failed: totalFailed,
          }),
      timeout: 5000,
    });
  }
});

const statusClass = (file: DownloadProgress) => {
  if (file.status === "completed") return "status-completed";
  if (file.status === "failed") return "status-failed";
  if (file.status === "downloading") return "status-downloading";
  return "status-pending";
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.download-progress-panel {
  width: 260px;
  max-height: 360px;
  overflow-y: auto;
  padding: $spacing-xs;
}

.group-list {
  margin-bottom: $spacing-sm;
}

.group-title {
  font-size: $font-xs;
  font-weight: $font-medium;
}

.group-summary {
  font-size: $font-xs;
}

.file-item {
  padding: $spacing-xs 0;
}

.file-info {
  gap: 2px !important;
  width: 100%;
}

.file-name {
  font-size: $font-xs;
  max-width: 200px;
}

.file-status {
  font-size: $font-xs;
  margin-left: auto;
}

.status-completed {
  color: var(--success-color);
}

.status-failed {
  color: var(--error-color);
}

.status-downloading {
  color: var(--primary-color);
}

.status-pending {
  color: var(--text-quaternary);
}

.done-text {
  font-size: $font-xs;
}

.panel-footer {
  padding: $spacing-sm 0;
}
</style>