import { describe, it, expect, vi } from "vitest";

// vi.mock 提升：工厂引用的变量必须先用 vi.hoisted 创建
const m = vi.hoisted(() => ({
  query: vi.fn(),
  findBy: vi.fn(),
  findBlockEmbeddingByBlockId: vi.fn(),
  searchBlockEmbeddings: vi.fn(),
  rerank: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = m.query;
    update = m.update;
    findById = vi.fn(() => null);
  },
  ProjectChunkDao: class {
    findBy = m.findBy;
  },
}));

vi.mock("@/main/core/db/semanticLink.dao", () => ({
  semanticLinkDao: {
    findByChunkId: vi.fn(() => []),
    create: vi.fn(),
  },
}));

vi.mock("@/main/core/services/vector.service", () => ({
  vectorService: {
    findBlockEmbeddingByBlockId: m.findBlockEmbeddingByBlockId,
    searchBlockEmbeddings: m.searchBlockEmbeddings,
  },
}));

vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localGateway: { rerank: m.rerank },
}));

vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn() },
}));

import { SemanticLinkExecutor } from "@/main/core/smart-tasks/executors/semantic-link.executor";
import type { TaskContext } from "@/main/core/smart-tasks/types";

function makeContext(): TaskContext {
  return {
    processedUntil: null,
    cancelSignal: { cancelled: false },
  } as unknown as TaskContext;
}

describe("SemanticLinkExecutor 作品隔离", () => {
  it("块归属作品时，ANN 检索限制在同一作品内", async () => {
    m.query.mockReturnValue([
      { id: "b1", content: "本作品的块", ai_summary: "本作品的块" },
    ]);
    m.findBy.mockReturnValue([{ chunk_id: "b1", project_id: "p1" }]);
    m.findBlockEmbeddingByBlockId.mockResolvedValue([{ embedding: [0, 1] }]);
    m.searchBlockEmbeddings.mockResolvedValue([]);

    await new SemanticLinkExecutor().run(makeContext());

    expect(m.searchBlockEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1" }),
    );
  });

  it("块未归属作品（如日记）时保持全局检索，不传 projectId", async () => {
    m.query.mockReturnValue([
      { id: "b2", content: "日记块", ai_summary: "日记块" },
    ]);
    m.findBy.mockReturnValue([]);
    m.findBlockEmbeddingByBlockId.mockResolvedValue([{ embedding: [0, 1] }]);
    m.searchBlockEmbeddings.mockClear();
    m.searchBlockEmbeddings.mockResolvedValue([]);

    await new SemanticLinkExecutor().run(makeContext());

    const arg = m.searchBlockEmbeddings.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect("projectId" in arg).toBe(false);
  });
});
