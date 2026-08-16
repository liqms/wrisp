import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { DownloadProgress } from "@/main/types/download.types";

export interface DownloadGroupState {
  groupId: string;
  files: DownloadProgress[];
  startedAt: number;
}

export const useDownloadStore = defineStore("download", () => {
  // 按 groupId 分组的下载进度
  const groups = ref<Map<string, DownloadGroupState>>(new Map());

  // 所有正在进行的下载组 ID
  const activeGroupIds = computed(() =>
    Array.from(groups.value.keys()).filter((gid) => {
      const group = groups.value.get(gid);
      if (!group) return false;
      return group.files.some(
        (f) => f.status === "pending" || f.status === "downloading",
      );
    }),
  );

  // 是否有活跃下载
  const hasActiveDownloads = computed(() => activeGroupIds.value.length > 0);

  // 获取某个组的进度汇总
  const getGroupProgress = (groupId: string) => {
    const group = groups.value.get(groupId);
    if (!group) return null;

    const files = group.files;
    const total = files.length;
    const completed = files.filter((f) => f.status === "completed").length;
    const failed = files.filter((f) => f.status === "failed").length;
    const cancelled = files.filter((f) => f.status === "cancelled").length;
    const active = files.filter((f) => f.status === "downloading").length;
    const pending = files.filter((f) => f.status === "pending").length;

    // 平均进度
    const totalProgress = files.reduce(
      (sum, f) => sum + (f.progress || 0),
      0,
    );
    const avgProgress = total > 0 ? Math.round(totalProgress / total) : 0;

    const isDone =
      completed + failed + cancelled === total && total > 0;

    return {
      groupId,
      total,
      completed,
      failed,
      cancelled,
      active,
      pending,
      avgProgress,
      isDone,
      files,
    };
  };

  // 所有活跃组的进度汇总
  const allGroupsProgress = computed(() => {
    return Array.from(groups.value.keys())
      .map((gid) => getGroupProgress(gid))
      .filter(Boolean);
  });

  // 添加一个新组
  const addGroup = (groupId: string) => {
    if (!groups.value.has(groupId)) {
      groups.value.set(groupId, {
        groupId,
        files: [],
        startedAt: Date.now(),
      });
    }
  };

  // 更新单文件进度
  const updateFileProgress = (progress: DownloadProgress) => {
    const groupId = progress.groupId;
    if (!groupId) return;

    if (!groups.value.has(groupId)) {
      addGroup(groupId);
    }

    const group = groups.value.get(groupId)!;
    const existingIdx = group.files.findIndex(
      (f) => f.taskId === progress.taskId,
    );

    if (existingIdx >= 0) {
      group.files[existingIdx] = { ...group.files[existingIdx], ...progress };
    } else {
      group.files.push({ ...progress });
    }
  };

  // 移除已完成组
  const removeGroup = (groupId: string) => {
    groups.value.delete(groupId);
  };

  // IPC 监听器清理
  let cleanupFns: (() => void)[] = [];

  const setupListeners = () => {
    const onProgress = (data: unknown) => {
      updateFileProgress(data as DownloadProgress);
    };

    window.electronAPI.on("download:progress", onProgress);

    cleanupFns = [() => window.electronAPI.off("download:progress")];
  };

  const destroyListeners = () => {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
  };

  return {
    groups,
    activeGroupIds,
    hasActiveDownloads,
    getGroupProgress,
    allGroupsProgress,
    addGroup,
    updateFileProgress,
    removeGroup,
    setupListeners,
    destroyListeners,
  };
});