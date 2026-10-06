// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  readFileMock,
  findByIdMock,
  updateSyncStatusMock,
  enqueueMock,
  replaceFileChunksMock,
  dropVectorsByIdsMock,
  associateMock,
  isLocalAvailableMock,
  embedBatchMock,
} = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  findByIdMock: vi.fn(),
  updateSyncStatusMock: vi.fn(),
  enqueueMock: vi.fn(),
  replaceFileChunksMock: vi.fn(),
  dropVectorsByIdsMock: vi.fn(),
  associateMock: vi.fn(),
  isLocalAvailableMock: vi.fn(),
  embedBatchMock: vi.fn(),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  FileIndexDao: class {
    findById = findByIdMock;
    updateSyncStatus = updateSyncStatusMock;
  },
}));
vi.mock("@/main/core/task-queue", () => ({
  taskQueue: {
    enqueue: enqueueMock,
    getTasksByGroup: vi.fn(async () => []),
    cancel: vi.fn(),
  },
}));
vi.mock("@/main/core/services/base/file.service", () => ({
  fileService: { readFile: (path: string) => readFileMock(path) },
}));
vi.mock("@/main/core/model-gateway/router", () => ({
  modelRouter: { isLocalAvailable: () => isLocalAvailableMock() },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  embedBatch: (texts: string[]) => embedBatchMock(texts),
}));
vi.mock("@/main/core/services/content/chunk.service", () => ({
  chunkService: {
    replaceFileChunks: replaceFileChunksMock,
    dropVectorsByIds: dropVectorsByIdsMock,
    associateFileChunksWithProject: associateMock,
  },
}));
vi.mock("@/main/core/services/content/wiki-events", () => ({
  notifyWikiUpdated: vi.fn(),
}));

import {
  chunkIndexService,
  chunkRefineTaskGroupId,
  TASK_TYPE_FILE_CHUNK_REFINE,
} from "@/main/core/services/content/chunk-index.service";

/** 4 句（向量）+ 3 句（前端）：整块越过 L2 的 500 字符预算，语义边界在第 4/5 行 */
const MD = [
  ...[1, 2, 3, 4].map((i) => `向量第${i}句：${"检索要点".repeat(23)}。`),
  ...[5, 6, 7].map((i) => `前端渲染：${"编辑器".repeat(28)}第${i}句。`),
].join("\n");

const SHORT_MD = "一句话段落。\n另一句段落。";

const INDEX = { id: "f1", file_path: "journal/2026-10-06.md", file_hash: "h1" };

function twoTopicVectors(texts: string[]): Array<{ vector: number[] }> {
  return texts.map((text) => ({
    vector: text.startsWith("向量") ? [1, 0] : [0, 1],
  }));
}

describe("切分任务与 L3 精修任务的衔接", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFileMock.mockReturnValue(MD);
    findByIdMock.mockReturnValue(INDEX);
    replaceFileChunksMock.mockReturnValue({
      reused: 0,
      inserted: 2,
      removedIds: ["old1"],
      total: 2,
    });
    dropVectorsByIdsMock.mockResolvedValue(undefined);
    isLocalAvailableMock.mockResolvedValue(true);
    embedBatchMock.mockImplementation(async (texts: string[]) => twoTopicVectors(texts));
  });

  it("存在超长块时，切分完成后排入精修任务（独立分组，不影响切分互斥）", async () => {
    await chunkIndexService.processFile("f1", "h1", "journal", null);

    expect(replaceFileChunksMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TASK_TYPE_FILE_CHUNK_REFINE,
        groupId: chunkRefineTaskGroupId("f1"),
      }),
    );
  });

  it("结构上已是精块时不再排精修任务", async () => {
    readFileMock.mockReturnValue(SHORT_MD);

    await chunkIndexService.processFile("f1", "h1", "journal", null);

    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("向量清理只针对正文消失的块，且发生在写库之后", async () => {
    await chunkIndexService.processFile("f1", "h1", "journal", null);

    expect(dropVectorsByIdsMock).toHaveBeenCalledWith(["old1"]);
    expect(dropVectorsByIdsMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      replaceFileChunksMock.mock.invocationCallOrder[0],
    );
  });

  it("没有块消失时不触碰向量库", async () => {
    replaceFileChunksMock.mockReturnValue({
      reused: 2,
      inserted: 0,
      removedIds: [],
      total: 2,
    });

    await chunkIndexService.processFile("f1", "h1", "journal", null);

    expect(dropVectorsByIdsMock).toHaveBeenCalledWith([]);
  });

  it("精修在语义低谷处替换长度边界", async () => {
    await chunkIndexService.processRefine("f1", "h1", "journal", null);

    const [fileId, , chunks] = replaceFileChunksMock.mock.calls[0];
    expect(fileId).toBe("f1");
    expect(chunks).toHaveLength(2);
    expect(chunks[0].endLine).toBe(4);
    expect(chunks.every((chunk: { layer: string }) => chunk.layer === "semantic")).toBe(true);
  });

  it("本地模型不可用时跳过精修，保留 L2 结果", async () => {
    isLocalAvailableMock.mockResolvedValueOnce(false);

    await chunkIndexService.processRefine("f1", "h1", "journal", null);

    expect(replaceFileChunksMock).not.toHaveBeenCalled();
    expect(updateSyncStatusMock).not.toHaveBeenCalled();
  });

  it("文件已变化时丢弃过期精修任务", async () => {
    await chunkIndexService.processRefine("f1", "stale-hash", "journal", null);

    expect(replaceFileChunksMock).not.toHaveBeenCalled();
  });

  it("推理异常只降级，不把文件标记为同步失败", async () => {
    embedBatchMock.mockRejectedValue(new Error("模型未加载"));

    await chunkIndexService.processRefine("f1", "h1", "journal", null);

    expect(replaceFileChunksMock).not.toHaveBeenCalled();
    expect(updateSyncStatusMock).not.toHaveBeenCalledWith("f1", "failed");
  });

  it("页面块精修后重新归属作品", async () => {
    await chunkIndexService.processRefine("f1", "h1", "page", "p1");

    expect(associateMock).toHaveBeenCalledWith("f1", "p1");
  });

  it("切分任务本身失败时标记同步失败并抛出（交由队列重试）", async () => {
    readFileMock.mockImplementation(() => {
      throw new Error("文件读取失败");
    });

    await expect(
      chunkIndexService.processFile("f1", "h1", "journal", null),
    ).rejects.toThrow("文件读取失败");
    expect(updateSyncStatusMock).toHaveBeenCalledWith("f1", "failed");
  });
});
