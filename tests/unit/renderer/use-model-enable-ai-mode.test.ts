import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModel } from "@/renderer/composables/useModel";
import { ErrorCode } from "@/shared/enums";

interface ModelApiStub {
  getConfig: ReturnType<typeof vi.fn>;
  setValue: ReturnType<typeof vi.fn>;
  checkModelExist: ReturnType<typeof vi.fn>;
  downloadModel: ReturnType<typeof vi.fn>;
  cancelDownload: ReturnType<typeof vi.fn>;
}

let api: ModelApiStub;

function ok<T>(data: T) {
  return { success: true, data, code: ErrorCode.SUCCESS, timestamp: Date.now() };
}

function stubModelApi(existStatus: Record<string, boolean>): void {
  api = {
    getConfig: vi.fn().mockResolvedValue(ok({ enableAiMode: false, enableCloudAi: true })),
    setValue: vi.fn().mockResolvedValue(ok(undefined)),
    checkModelExist: vi.fn().mockResolvedValue(ok(existStatus)),
    downloadModel: vi
      .fn()
      .mockImplementation((type: string) => Promise.resolve(ok(`model-download-${type}-1`))),
    cancelDownload: vi.fn().mockResolvedValue(ok(undefined)),
  };
  const electronAPI = window.electronAPI as unknown as Record<string, unknown>;
  electronAPI.model = api;
}

const MISSING_LLM = {
  "bge-m3": true,
  "bge-reranker-v2-m3": true,
  "qwen3.5-4b": false,
};

beforeEach(() => {
  setActivePinia(createPinia());
  stubModelApi(MISSING_LLM);
});

describe("useModel.updateEnableAiMode", () => {
  it("开启本地智能时一并下载 base 与 core（含本地 LLM）", async () => {
    const { updateEnableAiMode } = useModel({ autoInit: false });

    await updateEnableAiMode(true);

    expect(api.downloadModel).toHaveBeenCalledWith("base");
    expect(api.downloadModel).toHaveBeenCalledWith("core");
  });

  it("模型文件已全部就绪时不触发任何下载", async () => {
    stubModelApi({
      "bge-m3": true,
      "bge-reranker-v2-m3": true,
      "qwen3.5-4b": true,
    });
    const { updateEnableAiMode } = useModel({ autoInit: false });

    await updateEnableAiMode(true);

    expect(api.downloadModel).not.toHaveBeenCalled();
  });

  it("关闭本地智能时取消 base 与 core 两个下载组", async () => {
    const { updateEnableAiMode } = useModel({ autoInit: false });

    await updateEnableAiMode(true);
    await updateEnableAiMode(false);

    expect(api.cancelDownload).toHaveBeenCalledWith("model-download-base-1");
    expect(api.cancelDownload).toHaveBeenCalledWith("model-download-core-1");
  });
});
