import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { SmartTaskSnapshot, SmartTaskStep } from "@/shared/types";
import { useSmartTaskStore } from "@/renderer/store/smart-task.store";
import { useWikiStore } from "@/renderer/store/wiki.store";

function snapshot(
  status: SmartTaskSnapshot["status"],
  overallPercent: number,
  steps: Partial<SmartTaskStep>[],
): SmartTaskSnapshot {
  return {
    executionId: "exec-1",
    status,
    overallPercent,
    steps: steps.map((step, index) => ({
      id: step.id ?? `step-${index}`,
      kind: step.kind ?? "task",
      ref: step.ref ?? `task-${index}`,
      state: step.state ?? "pending",
      ...step,
    })) as SmartTaskStep[],
  };
}

/** 全局 setup 里没有 smartTask 模块，按需补一个最小桩 */
function stubSmartTaskApi(overrides: Record<string, unknown> = {}): void {
  (window.electronAPI as unknown as Record<string, unknown>).smartTask = {
    start: vi.fn().mockResolvedValue({ success: true }),
    cancel: vi.fn().mockResolvedValue({ success: true }),
    pause: vi.fn().mockResolvedValue({ success: true }),
    resume: vi.fn().mockResolvedValue({ success: true }),
    onSnapshot: vi.fn(() => () => undefined),
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { snapshot: null } }),
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  stubSmartTaskApi();
});

describe("useSmartTaskStore 状态派生", () => {
  it("无快照时为 idle，不展示进度入口", () => {
    const store = useSmartTaskStore();
    expect(store.status).toBe("idle");
    expect(store.isRunning).toBe(false);
    expect(store.isPaused).toBe(false);
    expect(store.percent).toBe(0);
    expect(store.visible).toBe(false);
  });

  it("running / paused 都算进行中，只有 paused 触发暂停态", () => {
    const store = useSmartTaskStore();

    store.snapshot = snapshot("running", 45, [{ ref: "chunk-vectorize", state: "running" }]);
    expect(store.isRunning).toBe(true);
    expect(store.isPaused).toBe(false);
    expect(store.percent).toBe(45);

    store.snapshot = snapshot("paused", 45, [{ ref: "chunk-vectorize", state: "running" }]);
    expect(store.isRunning).toBe(true);
    expect(store.isPaused).toBe(true);
  });

  it("结束态不算进行中：失败/取消不再显示成整理中", () => {
    const store = useSmartTaskStore();
    for (const status of ["completed", "failed", "cancelled"] as const) {
      store.snapshot = snapshot(status, 100, []);
      expect(store.isRunning).toBe(false);
      expect(store.status).toBe(status);
    }
  });

  it("failedCount 汇总各步骤失败条目，未上报的阶段不计", () => {
    const store = useSmartTaskStore();
    store.snapshot = snapshot("completed", 100, [
      { ref: "chunk-vectorize", state: "success", processedCount: 90, failedCount: 10 },
      { ref: "semantic-link", state: "success", processedCount: 0, failedCount: 3 },
      { ref: "topic-summary", state: "success", processedCount: 5 },
    ]);
    expect(store.failedCount).toBe(13);
  });

  it("currentTask 取正在执行的任务步骤，忽略模型/准备节点", () => {
    const store = useSmartTaskStore();
    store.snapshot = snapshot("running", 45, [
      { kind: "prepare", ref: "prepare", state: "success" },
      { kind: "model-load", ref: "embedding", state: "running" },
      { kind: "task", ref: "semantic-link", state: "running" },
    ]);
    expect(store.currentTask).toBe("semantic-link");
  });

  it("无正在执行的任务时 currentTask 为 null", () => {
    const store = useSmartTaskStore();
    store.snapshot = snapshot("completed", 100, [
      { kind: "task", ref: "semantic-link", state: "success" },
    ]);
    expect(store.currentTask).toBeNull();
  });
});

describe("useWikiStore 整理状态跟主进程快照", () => {
  it("organizing / organizePaused 由 smartTask 快照派生", () => {
    const wiki = useWikiStore();
    const smartTask = useSmartTaskStore();
    expect(wiki.organizing).toBe(false);

    smartTask.snapshot = snapshot("running", 20, [{ ref: "chunk-summary", state: "running" }]);
    expect(wiki.organizing).toBe(true);
    expect(wiki.organizePaused).toBe(false);

    smartTask.snapshot = snapshot("paused", 20, [{ ref: "chunk-summary", state: "running" }]);
    expect(wiki.organizing).toBe(true);
    expect(wiki.organizePaused).toBe(true);

    smartTask.snapshot = snapshot("completed", 100, []);
    expect(wiki.organizing).toBe(false);
    expect(wiki.organizePaused).toBe(false);
  });

  it("clear 不把整理中状态清掉（它不属于本地状态）", () => {
    const wiki = useWikiStore();
    const smartTask = useSmartTaskStore();
    smartTask.snapshot = snapshot("running", 20, []);
    wiki.clear();
    expect(wiki.organizing).toBe(true);
  });

  it("启动失败时 startOrganize 返回 false（IPC 不抛错，只看 success）", async () => {
    stubSmartTaskApi({
      start: vi.fn().mockResolvedValue({ success: false, code: "LOCAL_AI_DISABLED" }),
    });
    const wiki = useWikiStore();
    await expect(wiki.startOrganize()).resolves.toBe(false);
  });

  it("启动异常时 startOrganize 返回 false 而不是抛出", async () => {
    stubSmartTaskApi({ start: vi.fn().mockRejectedValue(new Error("ipc down")) });
    const wiki = useWikiStore();
    await expect(wiki.startOrganize()).resolves.toBe(false);
  });
});
