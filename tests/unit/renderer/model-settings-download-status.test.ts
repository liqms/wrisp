import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { createI18n } from "vue-i18n";
import ModelSettings from "@/renderer/components/settings/model/ModelSettings.vue";
import { naive } from "@/renderer/plugins/naive-ui";
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import { useDownloadStore } from "@/renderer/store/download.store";
import { ErrorCode } from "@/shared/enums";
import type { DownloadProgress } from "@/main/types/download.types";
import type { ModelManifestEntry } from "@/shared/types/model.types";

const HOST = "https://hf-mirror.com";

const MANIFEST: ModelManifestEntry[] = [
  {
    modelId: "bge-m3",
    family: "embedding",
    sizeGB: 1.13,
    files: [
      { remotePath: "Xenova/bge-m3/resolve/main/onnx/model_fp16.onnx", localPath: "onnx/model_fp16.onnx" },
      { remotePath: "Xenova/bge-m3/resolve/main/config.json", localPath: "config.json" },
    ],
  },
  {
    modelId: "bge-reranker-v2-m3",
    family: "reranker",
    sizeGB: 1.8,
    files: [
      { remotePath: "onnx-community/bge-reranker-v2-m3-ONNX/resolve/main/onnx/model_fp16.onnx", localPath: "onnx/model_fp16.onnx" },
    ],
  },
  {
    modelId: "qwen3.5-4b",
    family: "llm",
    sizeGB: 2.9,
    files: [
      { remotePath: "unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-UD-Q4_K_XL.gguf", localPath: "Qwen3.5-4B-UD-Q4_K_XL.gguf" },
    ],
  },
];

const LLM_REMOTE = MANIFEST[2].files[0].remotePath;

function ok<T>(data: T) {
  return { success: true, data, code: ErrorCode.SUCCESS, timestamp: Date.now() };
}

let existStatus: Record<string, boolean>;
let checkModelExist: ReturnType<typeof vi.fn>;
let downloadModel: ReturnType<typeof vi.fn>;
let pinia: Pinia;

function stubModelApi(): void {
  checkModelExist = vi.fn().mockImplementation(() => Promise.resolve(ok(existStatus)));
  downloadModel = vi
    .fn()
    .mockImplementation((type: string) => Promise.resolve(ok(`model-download-${type}-1`)));

  const electronAPI = window.electronAPI as unknown as Record<string, unknown>;
  electronAPI.model = {
    getConfig: vi.fn().mockResolvedValue(
      ok({ enableAiMode: true, enableCloudAi: false, enableGpuAcceleration: false, localLlmTasks: [] }),
    ),
    setValue: vi.fn().mockResolvedValue(ok(undefined)),
    getModelManifest: vi.fn().mockResolvedValue(ok(MANIFEST)),
    getDownloadTasks: vi.fn().mockResolvedValue(ok([])),
    checkModelExist,
    downloadModel,
    cancelDownload: vi.fn().mockResolvedValue(ok(undefined)),
    getGpuCapability: vi.fn().mockResolvedValue(ok(null)),
    getThreadBudget: vi.fn().mockResolvedValue(ok(null)),
  };
}

const i18n = createI18n({
  legacy: false,
  locale: "zhCN",
  fallbackLocale: "zhCN",
  messages: { zhCN: zhCNMessages },
  globalInjection: true,
  allowComposition: true,
  missingWarn: false,
  fallbackWarn: false,
});

function mountPage(): VueWrapper {
  return mount(ModelSettings, { global: { plugins: [pinia, i18n, naive] } });
}

function pushDownload(
  status: DownloadProgress["status"],
  overrides: Partial<DownloadProgress> = {},
): void {
  useDownloadStore().updateFileProgress({
    taskId: "gguf-task",
    url: `${HOST}/${LLM_REMOTE}`,
    status,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 2_912_109_728,
    groupId: "model-download-core-1",
    fileName: "Qwen3.5-4B-UD-Q4_K_XL.gguf",
    ...overrides,
  });
}

function rows(wrapper: VueWrapper): VueWrapper[] {
  return wrapper.findAll(".download-button");
}

beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  existStatus = { "bge-m3": false, "bge-reranker-v2-m3": false, "qwen3.5-4b": false };
  stubModelApi();
});

describe("ModelSettings 本地模型下载状态", () => {
  it("按主进程清单渲染三行本地模型", async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(window.electronAPI.model.getModelManifest).toHaveBeenCalled();
    expect(rows(wrapper)).toHaveLength(3);
    expect(wrapper.text()).toContain("嵌入模型");
    expect(wrapper.text()).toContain("重排序模型");
    expect(wrapper.text()).toContain("语言模型");
  });

  it("磁盘上没有文件时显示为待下载", async () => {
    const wrapper = mountPage();
    await flushPromises();

    for (const row of rows(wrapper)) {
      expect(row.classes()).toContain("status-pending");
    }
  });

  it("GGUF 下载失败时显示失败提示，而不是永远卡在百分比", async () => {
    const wrapper = mountPage();
    await flushPromises();

    pushDownload("failed", { progress: 45, downloadedBytes: 1_300_000_000, error: "timeout" });
    await flushPromises();

    const llmRow = rows(wrapper)[2];
    expect(llmRow.classes()).toContain("status-failed");
    expect(llmRow.text()).toContain("下载失败");
    expect(llmRow.text()).not.toContain("45%");
  });

  it("多文件模型只下完一个小文件时仍显示下载中", async () => {
    const wrapper = mountPage();
    await flushPromises();

    useDownloadStore().updateFileProgress({
      taskId: "cfg-task",
      url: `${HOST}/Xenova/bge-m3/resolve/main/config.json`,
      status: "completed",
      progress: 100,
      downloadedBytes: 770,
      totalBytes: 770,
      groupId: "model-download-base-1",
      fileName: "config.json",
    });
    await flushPromises();

    const embeddingRow = rows(wrapper)[0];
    expect(embeddingRow.classes()).not.toContain("status-completed");
  });

  it("下载全部完成后自动重查磁盘状态，无需重开设置页", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const callsAfterMount = checkModelExist.mock.calls.length;

    pushDownload("downloading", { progress: 40, downloadedBytes: 1_160_000_000 });
    await flushPromises();
    expect(rows(wrapper)[2].text()).toContain("40%");

    existStatus = { ...existStatus, "qwen3.5-4b": true };
    pushDownload("completed", { progress: 100, downloadedBytes: 2_912_109_728 });
    await flushPromises();

    expect(checkModelExist.mock.calls.length).toBeGreaterThan(callsAfterMount);
    expect(rows(wrapper)[2].classes()).toContain("status-completed");
  });

  it("点击语言模型行触发 core 下载", async () => {
    const wrapper = mountPage();
    await flushPromises();

    await rows(wrapper)[2].trigger("click");
    await flushPromises();

    expect(downloadModel).toHaveBeenCalledWith("core");
  });
});
