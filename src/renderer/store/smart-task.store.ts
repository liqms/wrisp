
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ApiResponse, SmartTaskSnapshot, SmartTaskRunStatus } from "@/shared/types";

/** 完成后保留结束提示的时长（ms） */
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

  const status = computed<SmartTaskRunStatus>(() => snapshot.value?.status ?? "idle");
  const isRunning = computed(
    () => status.value === "running" || status.value === "paused",
  );
  const isPaused = computed(() => status.value === "paused");
  const percent = computed(() => snapshot.value?.overallPercent ?? 0);
  const steps = computed(() => snapshot.value?.steps ?? []);
  const visible = computed(() => isRunning.value || showCompleted.value);

  /** 本轮失败条目总数（未上报 failedCount 的阶段不计） */
  const failedCount = computed(() =>
    steps.value.reduce((sum, step) => sum + (step.failedCount ?? 0), 0),
  );

  /** 当前正在执行的任务名，用于「当前阶段」一行 */
  const currentTask = computed(
    () => steps.value.find((s) => s.kind === "task" && s.state === "running")?.ref ?? null,
  );

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

    // 运行 → 结束：保留 5 秒结束提示
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
    status,
    isRunning,
    isPaused,
    percent,
    steps,
    failedCount,
    currentTask,
    visible,
    init,
    dispose,
  };
});
