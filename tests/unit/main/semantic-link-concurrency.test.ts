// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const findByIdMock = vi.fn();
const chunkUpdateMock = vi.fn();
const projectFindByMock = vi.fn(() => []);
const findBlockEmbeddingMock = vi.fn();
const searchBlockEmbeddingsMock = vi.fn();
const rerankMock = vi.fn();
const findByChunkIdMock = vi.fn(() => []);
const linkCreateMock = vi.fn(() => "l1");

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    findById = findByIdMock;
    update = chunkUpdateMock;
  },
  ProjectChunkDao: class {
    findBy = projectFindByMock;
  },
}));
vi.mock("@/main/core/services/ai/vector.service", () => ({
  vectorService: {
    findBlockEmbeddingByBlockId: (...a: unknown[]) =>
      findBlockEmbeddingMock(...a),
    searchBlockEmbeddings: (...a: unknown[]) => searchBlockEmbeddingsMock(...a),
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
    findByIdMock
      .mockReset()
      .mockReturnValue({ id: "other", content: "c", ai_summary: "s" });
    chunkUpdateMock.mockReset();
    projectFindByMock.mockReset().mockReturnValue([]);
    findBlockEmbeddingMock.mockReset();
    searchBlockEmbeddingsMock.mockReset();
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
    searchBlockEmbeddingsMock.mockResolvedValue([
      { item: { block_id: "other" } },
    ]);

    let active = 0;
    let maxObserved = 0;
    findBlockEmbeddingMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return [{ embedding: [0.1, 0.2] }];
    });

    const executor = new SemanticLinkExecutor();
    const result = await executor.run({
      executionId: "e1",
      processedUntil: null,
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(8);
    expect(maxObserved).toBe(SEMANTIC_LINK_CONCURRENCY);
    expect(chunkUpdateMock).toHaveBeenCalledTimes(8);
  });
});