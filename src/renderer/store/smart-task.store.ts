
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ApiResponse, SmartTaskSnapshot } from "@/shared/types";

/** 完成后保留"整理完成"提示的时长（ms） */
const COMPLETED_RETENTION_MS = 5000;

/** 调度器状态返回结构（getStatus 的 data 部分） */
interface SmartTaskStatusData {
  snapshot?: SmartTaskSnapshot;
}

export const useSmartTaskStore = defineStore("smartTask", () => {
  const snapshot = ref<SmartTaskSnapshot | null>(null);
  const showCompleted = ref(false);

  let disposeSnapshot: (() => void) | null = null;
  let completedTimer: ReturnType<typeof setTimeout> | undefined;

  const isRunning = computed(
    () => snapshot.value?.status === "running" || snapshot.value?.status === "paused",
  );
  const percent = computed(() => snapshot.value?.overallPercent ?? 0);
  const steps = computed(() => snapshot.value?.steps ?? []);
  const visible = computed(() => isRunning.value || showCompleted.value);

  const clearCompletedTimer = (): void => {
    if (completedTimer) {
      clearTimeout(completedTimer);
      completedTimer = undefined;
    }
  };

  const handleSnapshot = (next: SmartTaskSnapshot): void => {
    const wasRunning = isRunning.value;
    snapshot.value = next;

    if (isRunning.value) {
      showCompleted.value = false;
      clearCompletedTimer();
      return;
    }

    // 运行 → 结束：保留 5 秒完成提示
    if (wasRunning) {
      showCompleted.value = true;
      clearCompletedTimer();
      completedTimer = setTimeout(() => {
        showCompleted.value = false;
        completedTimer = undefined;
      }, COMPLETED_RETENTION_MS);
    }
  };

  /** 订阅主进程推送并同步当前状态（供 AppHeader 挂载时调用） */
  const init = async (): Promise<void> => {
    if (!disposeSnapshot) {
      disposeSnapshot = window.electronAPI.smartTask.onSnapshot(handleSnapshot);
    }

    // 窗口重载 / 热更后，主动拉取一次当前快照
    try {
      const response = (await window.electronAPI.smartTask.getStatus()) as ApiResponse<SmartTaskStatusData>;
      const data = (response?.data ?? null) as SmartTaskStatusData | null;
      const initial = data?.snapshot;
      if (initial && initial.steps.length > 0) {
        snapshot.value = initial;
      }
    } catch {
      // 静默失败，进度不影响核心功能
    }
  };

  const dispose = (): void => {
    disposeSnapshot?.();
    disposeSnapshot = null;
    clearCompletedTimer();
  };

  return {
    snapshot,
    showCompleted,
    isRunning,
    percent,
    steps,
    visible,
    init,
    dispose,
  };
});