// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const findByIdsMock = vi.fn();
const recordStageMock = vi.fn();
const findByChunkIdsMock = vi.fn(() => []);
const findChunkEmbeddingMock = vi.fn();
const searchChunkEmbeddingsMock = vi.fn();
const rerankMock = vi.fn();
const findByChunkIdMock = vi.fn(() => []);
const linkCreateMock = vi.fn(() => "l1");

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    findByIds = findByIdsMock;
    recordStage = recordStageMock;
  },
  ProjectChunkDao: class {
    findByChunkIds = findByChunkIdsMock;
  },
}));
vi.mock("@/main/core/services/ai/vector.service", () => ({
  vectorService: {
    findChunkEmbeddingByChunkId: (...a: unknown[]) =>
      findChunkEmbeddingMock(...a),
    searchChunkEmbeddings: (...a: unknown[]) => searchChunkEmbeddingsMock(...a),
  },
}));
vi.mock("@/main/core/db/semanticLink.dao", () => ({
  semanticLinkDao: {
    findByChunkId: (...a: unknown[]) => findByChunkIdMock(...a),
    create: (...a: unknown[]) => linkCreateMock(...a),
  },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localGateway: { rerank: (...a: unknown[]) => rerankMock(...a) },
}));
vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn(), completeTask: vi.fn() },
}));

import {
  SemanticLinkExecutor,
  SEMANTIC_LINK_CONCURRENCY,
} from "@/main/core/smart-tasks/executors/semantic-link.executor";

describe("SemanticLinkExecutor 有界并发", () => {
  beforeEach(() => {
    queryMock.mockReset();
    findByIdsMock
      .mockReset()
      .mockReturnValue([{ id: "other", content: "c", ai_summary: "s" }]);
    recordStageMock.mockReset();
    findByChunkIdsMock.mockReset().mockReturnValue([]);
    findChunkEmbeddingMock.mockReset();
    searchChunkEmbeddingsMock.mockReset();
    rerankMock.mockReset().mockReturnValue([{ index: 0, score: 0.9 }]);
    findByChunkIdMock.mockReset().mockReturnValue([]);
    linkCreateMock.mockReset();
  });

  it("并发上限为 SEMANTIC_LINK_CONCURRENCY 且每块都写库", async () => {
    queryMock.mockReturnValue(
      Array.from({ length: 8 }, (_, i) => ({
        id: `b${i}`,
        content: "text",
        ai_summary: "summary",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    );
    searchChunkEmbeddingsMock.mockResolvedValue([
      { item: { chunk_id: "other" } },
    ]);

    let active = 0;
    let maxObserved = 0;
    findChunkEmbeddingMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return [{ embedding: [0.1, 0.2] }];
    });

    const executor = new SemanticLinkExecutor();
    const result = await executor.run({
      executionId: "e1",
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(8);
    expect(maxObserved).toBe(SEMANTIC_LINK_CONCURRENCY);
    expect(recordStageMock).toHaveBeenCalledTimes(8);
    const columns = recordStageMock.mock.calls[0]?.[1] ?? [];
    expect(columns).toContain("last_linked_at");
  });

  it("无可链对象也写标记，避免每轮空转重跑", async () => {
    queryMock.mockReturnValue([
      {
        id: "b0",
        content: "text",
        ai_summary: "summary",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    // ANN 只召回自己 —— 过滤后候选为空
    findChunkEmbeddingMock.mockResolvedValue([{ embedding: [0.1] }]);
    searchChunkEmbeddingsMock.mockResolvedValue([{ item: { chunk_id: "b0" } }]);

    const result = await new SemanticLinkExecutor().run({
      executionId: "e2",
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.processedCount).toBe(1);
    expect(linkCreateMock).not.toHaveBeenCalled();
    expect(recordStageMock).toHaveBeenCalledTimes(1);
  });

  it("rerank 失败不写标记并计入 failedCount，下一轮重试", async () => {
    queryMock.mockReturnValue([
      {
        id: "b0",
        content: "text",
        ai_summary: "summary",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    findChunkEmbeddingMock.mockResolvedValue([{ embedding: [0.1] }]);
    searchChunkEmbeddingsMock.mockResolvedValue([{ item: { chunk_id: "other" } }]);
    rerankMock.mockRejectedValue(new Error("reranker 未加载"));

    const result = await new SemanticLinkExecutor().run({
      executionId: "e3",
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(recordStageMock).not.toHaveBeenCalled();
  });

  it("选取条件用 last_linked_at 专属标记列", async () => {
    queryMock.mockReturnValue([]);

    await new SemanticLinkExecutor().run({
      executionId: "e4",
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    const sql = (queryMock.mock.calls[0] ?? [""])[0] as string;
    expect(sql).toContain("last_linked_at IS NULL");
    expect(sql).toContain("updated_at > last_linked_at");
  });
});