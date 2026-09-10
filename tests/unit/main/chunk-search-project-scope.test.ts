import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/core/services/vector.service", () => ({
  vectorService: {
    searchBlockEmbeddings: vi.fn(async () => []),
  },
}));

// chunkService 现在会经 projectChunkDao 按实时归属过滤，
// 需要桩掉 DAO，避免访问未初始化的真实数据库。
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    searchFts = vi.fn(() => []);
    findByIds = vi.fn(() => []);
  },
  ProjectChunkDao: class {
    findBy = vi.fn(() => []);
  },
  ConceptChunkDao: class {
    countBy = vi.fn(() => 0);
  },
  TopicChunkDao: class {
    countBy = vi.fn(() => 0);
  },
}));

vi.mock("@/main/core/model-gateway/router", () => ({
  modelRouter: {
    isLocalAvailable: vi.fn(async () => true),
  },
}));

vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  embed: vi.fn(async () => ({ vector: [0, 1] })),
  rerank: vi.fn(async () => []),
}));

import { vectorService } from "@/main/core/services/vector.service";
import { chunkService } from "@/main/core/services/chunk.service";
import { SEARCH_TYPE } from "@/shared/enums";

describe("chunkService.search 作品隔离", () => {
  it("把 projectId 透传给向量检索", async () => {
    await chunkService.search("关键词", 5, SEARCH_TYPE.SEMANTIC, "p1");
    expect(vectorService.searchBlockEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1" }),
    );
  });
});
