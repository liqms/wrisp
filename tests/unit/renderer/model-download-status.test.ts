import { describe, it, expect } from "vitest";
import { computeModelDownloadState } from "@/renderer/utils/model-download-status";
import type { DownloadProgress } from "@/main/types/download.types";
import type { ModelManifestEntry } from "@/shared/types/model.types";

const HOST = "https://hf-mirror.com";

/** 嵌入模型：5 个文件，权重占绝大部分体积 */
const EMBEDDING: ModelManifestEntry = {
  modelId: "bge-m3",
  family: "embedding",
  sizeGB: 1.13,
  files: [
    { remotePath: "Xenova/bge-m3/resolve/main/onnx/model_fp16.onnx", localPath: "onnx/model_fp16.onnx" },
    { remotePath: "Xenova/bge-m3/resolve/main/tokenizer.json", localPath: "tokenizer.json" },
    { remotePath: "Xenova/bge-m3/resolve/main/tokenizer_config.json", localPath: "tokenizer_config.json" },
    { remotePath: "Xenova/bge-m3/resolve/main/config.json", localPath: "config.json" },
    { remotePath: "Xenova/bge-m3/resolve/main/special_tokens_map.json", localPath: "special_tokens_map.json" },
  ],
};

/** 本地 LLM：单个 2.9GB GGUF */
const LLM: ModelManifestEntry = {
  modelId: "qwen3.5-4b",
  family: "llm",
  sizeGB: 2.9,
  files: [
    {
      remotePath: "unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-UD-Q4_K_XL.gguf",
      localPath: "Qwen3.5-4B-UD-Q4_K_XL.gguf",
    },
  ],
};

let seq = 0;

function download(
  manifest: ModelManifestEntry,
  fileIndex: number,
  status: DownloadProgress["status"],
  bytes: { downloaded?: number; total?: number } = {},
): DownloadProgress {
  const file = manifest.files[fileIndex];
  seq += 1;
  return {
    taskId: `task-${seq}`,
    url: `${HOST}/${file.remotePath}`,
    status,
    progress: status === "completed" ? 100 : 0,
    downloadedBytes: bytes.downloaded ?? 0,
    totalBytes: bytes.total ?? 0,
    groupId: `model-download-base-1`,
    fileName: file.localPath.split("/").pop(),
  };
}

describe("computeModelDownloadState", () => {
  it("磁盘文件齐全时判定为已完成，忽略遗留的下载记录", () => {
    const state = computeModelDownloadState({
      manifest: EMBEDDING,
      existsOnDisk: true,
      downloads: [download(EMBEDDING, 0, "failed", { downloaded: 100, total: 1000 })],
    });

    expect(state).toEqual({ status: "completed", progress: 100 });
  });

  it("没有任何下载记录时判定为待下载", () => {
    const state = computeModelDownloadState({
      manifest: LLM,
      existsOnDisk: false,
      downloads: [],
    });

    expect(state).toEqual({ status: "pending", progress: 0 });
  });

  it("多文件模型只下完一个小文件时仍是下载中，进度按字节加权", () => {
    const state = computeModelDownloadState({
      manifest: EMBEDDING,
      existsOnDisk: false,
      downloads: [
        download(EMBEDDING, 4, "completed", { downloaded: 964, total: 964 }),
        download(EMBEDDING, 0, "downloading", { downloaded: 113_000_000, total: 1_133_992_936 }),
      ],
    });

    expect(state.status).toBe("downloading");
    // 113.0MB / 1.13GB ≈ 10%，绝不能因为首个文件 completed 就报 100%
    expect(state.progress).toBe(10);
  });

  it("全部文件下完后即使磁盘状态未刷新也判定为已完成", () => {
    const downloads = EMBEDDING.files.map((_, i) =>
      download(EMBEDDING, i, "completed", { downloaded: 10, total: 10 }),
    );

    const state = computeModelDownloadState({
      manifest: EMBEDDING,
      existsOnDisk: false,
      downloads,
    });

    expect(state).toEqual({ status: "completed", progress: 100 });
  });

  it("有文件失败时判定为失败，不再显示为下载中", () => {
    const state = computeModelDownloadState({
      manifest: LLM,
      existsOnDisk: false,
      downloads: [download(LLM, 0, "failed", { downloaded: 1_300_000_000, total: 2_912_109_728 })],
    });

    expect(state.status).toBe("failed");
    expect(state.progress).toBe(45);
  });

  it("被取消且无失败时判定为已取消", () => {
    const state = computeModelDownloadState({
      manifest: LLM,
      existsOnDisk: false,
      downloads: [download(LLM, 0, "cancelled", { downloaded: 500, total: 2_912_109_728 })],
    });

    expect(state.status).toBe("cancelled");
  });

  it("失败优先于取消暴露", () => {
    const state = computeModelDownloadState({
      manifest: EMBEDDING,
      existsOnDisk: false,
      downloads: [
        download(EMBEDDING, 0, "cancelled"),
        download(EMBEDDING, 1, "failed"),
      ],
    });

    expect(state.status).toBe("failed");
  });

  it("重试时后到的记录覆盖先前同文件的失败状态", () => {
    const state = computeModelDownloadState({
      manifest: LLM,
      existsOnDisk: false,
      downloads: [
        download(LLM, 0, "failed", { downloaded: 100, total: 2_912_109_728 }),
        download(LLM, 0, "downloading", { downloaded: 290_000_000, total: 2_912_109_728 }),
      ],
    });

    expect(state.status).toBe("downloading");
    expect(state.progress).toBe(10);
  });

  it("按 remotePath 精确匹配，同仓库的其他量化文件不会串到本模型", () => {
    const state = computeModelDownloadState({
      manifest: LLM,
      existsOnDisk: false,
      downloads: [
        {
          ...download(LLM, 0, "completed", { downloaded: 1, total: 1 }),
          url: `${HOST}/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-UD-Q4_K_M.gguf`,
        },
      ],
    });

    expect(state).toEqual({ status: "pending", progress: 0 });
  });

  it("注册表体积低估时进度封顶 99，避免未下完就显示 100%", () => {
    const state = computeModelDownloadState({
      manifest: LLM,
      existsOnDisk: false,
      downloads: [download(LLM, 0, "downloading", { downloaded: 3_500_000_000, total: 3_600_000_000 })],
    });

    expect(state.status).toBe("downloading");
    expect(state.progress).toBe(99);
  });

  it("缺少体积声明时退回按已知的 totalBytes 计算", () => {
    const state = computeModelDownloadState({
      manifest: { ...LLM, sizeGB: 0 },
      existsOnDisk: false,
      downloads: [download(LLM, 0, "downloading", { downloaded: 500, total: 1000 })],
    });

    expect(state).toEqual({ status: "downloading", progress: 50 });
  });

  it("尚未开始的文件计入待下载，只有排队记录时进度为 0", () => {
    const state = computeModelDownloadState({
      manifest: EMBEDDING,
      existsOnDisk: false,
      downloads: EMBEDDING.files.map((_, i) => download(EMBEDDING, i, "pending")),
    });

    expect(state).toEqual({ status: "downloading", progress: 0 });
  });
});
