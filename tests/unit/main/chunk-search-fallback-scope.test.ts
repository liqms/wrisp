import { describe, it, expect, vi } from "vitest";

// vi.mock 提升：工厂引用的变量必须先用 vi.hoisted 创建
const m = vi.hoisted(() => ({
  searchFts: vi.fn(),
  findBy: vi.fn(),
}));

vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    searchFts = m.searchFts;
    findByIds = vi.fn(() => []);
  },
  ProjectChunkDao: class {
    findBy = m.findBy;
  },
  ConceptChunkDao: class {
    findBy = vi.fn(() => []);
    findByChunkIds = vi.fn(() => []);
    countBy = vi.fn(() => 0);
  },
  TopicChunkDao: class {
    findBy = vi.fn(() => []);
    findByChunkIds = vi.fn(() => []);
    countBy = vi.fn(() => 0);
  },
}));

vi.mock("@/main/core/services/vector.service", () => ({
  vectorService: { searchBlockEmbeddings: vi.fn(async () => []) },
}));

// 关键：本地向量模型不可用 → 走全文检索降级路径
vi.mock("@/main/core/model-gateway/router", () => ({
  modelRouter: { isLocalAvailable: vi.fn(async () => false) },
}));

vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  embed: vi.fn(),
  rerank: vi.fn(),
}));

import { chunkService } from "@/main/core/services/chunk.service";
import { SEARCH_TYPE } from "@/shared/enums";

function stubChunk(id: string, content: string) {
  return {
    id,
    content,
    temporal_score: 1,
    word_count: 2,
    status: "active",
    created_at: "2026-09-11T00:00:00.000Z",
    updated_at: "2026-09-11T00:00:00.000Z",
  };
}

describe("chunkService.search 降级路径的作品隔离", () => {
  it("本地模型不可用时，全文检索结果仍按作品过滤（不得跨作品召回）", async () => {
    m.searchFts.mockReturnValue([
      stubChunk("c1", "本作品的块"),
      stubChunk("c2", "别的作品的块"),
    ]);
    m.findBy.mockReturnValue([{ chunk_id: "c1" }]);

    const result = await chunkService.search(
      "关键词",
      10,
      SEARCH_TYPE.SEMANTIC,
      "p1",
    );

    expect(result.map((r) => r.id)).toEqual(["c1"]);
  });

  it("未传 projectId 时保持既有行为（不过滤）", async () => {
    m.searchFts.mockReturnValue([
      stubChunk("c1", "a"),
      stubChunk("c2", "b"),
    ]);

    const result = await chunkService.search("关键词", 10, SEARCH_TYPE.SEMANTIC);

    expect(result.map((r) => r.id)).toEqual(["c1", "c2"]);
  });
});
