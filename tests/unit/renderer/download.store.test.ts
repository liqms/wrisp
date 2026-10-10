import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDownloadStore } from "@/renderer/store/download.store";
import { ErrorCode } from "@/shared/enums";
import type { DownloadProgress } from "@/main/types/download.types";

const GGUF_URL =
  "https://hf-mirror.com/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-UD-Q4_K_XL.gguf";

function task(
  taskId: string,
  overrides: Partial<DownloadProgress> = {},
): DownloadProgress {
  return {
    taskId,
    url: GGUF_URL,
    status: "downloading",
    progress: 40,
    downloadedBytes: 1_160_000_000,
    totalBytes: 2_912_109_728,
    groupId: "model-download-core-1",
    fileName: "Qwen3.5-4B-UD-Q4_K_XL.gguf",
    ...overrides,
  };
}

let getDownloadTasks: ReturnType<typeof vi.fn>;

function stubSnapshot(tasks: DownloadProgress[]): void {
  getDownloadTasks = vi.fn().mockResolvedValue({
    success: true,
    data: tasks,
    code: ErrorCode.SUCCESS,
    timestamp: Date.now(),
  });
  const electronAPI = window.electronAPI as unknown as Record<string, unknown>;
  electronAPI.model = {
    ...(electronAPI.model as Record<string, unknown>),
    getDownloadTasks,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  (window.electronAPI.on as ReturnType<typeof vi.fn>).mockReset();
});

describe("download.store 快照恢复", () => {
  it("setupListeners 时拉取现存任务，重开页面也能看到进行中的下载", async () => {
    stubSnapshot([task("t1")]);
    const store = useDownloadStore();

    await store.setupListeners();

    expect(getDownloadTasks).toHaveBeenCalledOnce();
    expect(store.getGroupProgress("model-download-core-1")).toMatchObject({
      total: 1,
      active: 1,
    });
    expect(store.hasActiveDownloads).toBe(true);
  });

  it("快照不覆盖已收到的实时进度", async () => {
    stubSnapshot([task("t1", { progress: 10, downloadedBytes: 100 })]);
    const store = useDownloadStore();
    store.updateFileProgress(task("t1", { progress: 60, downloadedBytes: 600 }));

    await store.setupListeners();

    expect(store.getGroupProgress("model-download-core-1")?.files[0]).toMatchObject({
      progress: 60,
      downloadedBytes: 600,
    });
  });

  it("快照接口不可用时不影响后续事件流", async () => {
    getDownloadTasks = vi.fn().mockRejectedValue(new Error("ipc down"));
    const electronAPI = window.electronAPI as unknown as Record<string, unknown>;
    electronAPI.model = {
      ...(electronAPI.model as Record<string, unknown>),
      getDownloadTasks,
    };
    const store = useDownloadStore();

    await store.setupListeners();
    store.updateFileProgress(task("t2"));

    expect(store.getGroupProgress("model-download-core-1")?.total).toBe(1);
  });
});
