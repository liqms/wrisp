// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  searchBlockEmbeddingsMock,
  findByIdsMock,
  rerankMock,
  countByMock,
} = vi.hoisted(() => ({
  searchBlockEmbeddingsMock: vi.fn(),
  findByIdsMock: vi.fn(),
  rerankMock: vi.fn(),
  countByMock: vi.fn(() => 0),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/services/ai/vector.service", () => ({
  vectorService: { searchBlockEmbeddings: searchBlockEmbeddingsMock },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    findByIds = findByIdsMock;
    searchFts = vi.fn(() => []);
  },
  ProjectChunkDao: class {
    findBy = vi.fn(() => []);
  },
  ConceptChunkDao: class {
    countBy = countByMock;
  },
  TopicChunkDao: class {
    countBy = countByMock;
  },
}));
vi.mock("@/main/core/model-gateway/router", () => ({
  modelRouter: { isLocalAvailable: vi.fn(async () => true) },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  embed: vi.fn(async () => ({ vector: [0, 1] })),
  rerank: rerankMock,
}));

import { chunkService } from "@/main/core/services/content/chunk.service";
import { SEARCH_TYPE } from "@/shared/enums";
import type { Chunk } from "@/main/types/db";

function chunk(
  id: string,
  fileId: string,
  startLine: number,
  endLine: number,
  createdAt: string,
): Chunk {
  return {
    id,
    file_id: fileId,
    file_path: `${fileId}.md`,
    start_line: startLine,
    end_line: endLine,
    section_title: null,
    content: `${id} 正文 ${startLine}-${endLine} 行`,
    content_hash: `hash-${id}`,
    chunk_type: "journal",
    is_deleted: 0,
    ai_summary: null,
    temporal_score: 0,
    word_count: 10,
    status: "active",
    last_smart_processed_at: null,
    last_vectorized_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

/** 用给定块驱动一次全库语义检索，返回命中块 id */
async function searchBlocks(blocks: Chunk[]): Promise<string[]> {
  findByIdsMock.mockReturnValue(blocks);
  searchBlockEmbeddingsMock.mockResolvedValue(
    blocks.map((block) => ({ item: { block_id: block.id }, score: 1 })),
  );
  const results = await chunkService.searchAll("重叠", 10, SEARCH_TYPE.SEMANTIC);
  return results.map((result) => result.id);
}

describe("向量检索的重叠块去重", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rerankMock.mockImplementation(
      async (_keyword: string, texts: string[]) =>
        texts.map((_, index) => ({ index, score: 1 - index * 0.1 })),
    );
  });

  it("行区间有交集的块只保留召回最靠前的一个", async () => {
    // b1[1-6] 与 b2[5-10] 因 L2 的 15% 句子重叠共享第 5、6 行
    const ids = await searchBlocks([
      chunk("b1", "f1", 1, 6, "2026-01-01T00:00:00.000Z"),
      chunk("b2", "f1", 5, 10, "2026-01-02T00:00:00.000Z"),
      chunk("b3", "f1", 20, 25, "2026-01-03T00:00:00.000Z"),
    ]);

    expect(ids).toEqual(["b1", "b3"]);
  });

  it("去重发生在 rerank 之前：重复正文不再参与重排", async () => {
    await searchBlocks([
      chunk("b1", "f1", 1, 6, "2026-01-01T00:00:00.000Z"),
      chunk("b2", "f1", 5, 10, "2026-01-02T00:00:00.000Z"),
      chunk("b3", "f1", 20, 25, "2026-01-03T00:00:00.000Z"),
    ]);

    const [keyword, texts] = rerankMock.mock.calls[0];
    expect(keyword).toBe("重叠");
    expect(texts).toHaveLength(2);
    expect(texts.some((text: string) => text.startsWith("b2"))).toBe(false);
  });

  it("紧邻但不相交的块不会被误删", async () => {
    const ids = await searchBlocks([
      chunk("c1", "f1", 1, 6, "2026-01-01T00:00:00.000Z"),
      chunk("c2", "f1", 7, 12, "2026-01-02T00:00:00.000Z"),
    ]);

    expect(ids).toEqual(["c1", "c2"]);
  });

  it("不同文件的同区间各自保留", async () => {
    const ids = await searchBlocks([
      chunk("d1", "f1", 1, 6, "2026-01-01T00:00:00.000Z"),
      chunk("d2", "f2", 1, 6, "2026-01-02T00:00:00.000Z"),
    ]);

    expect(ids).toEqual(["d1", "d2"]);
  });

  it("包含关系同样去重：大块命中后不再附带其子块", async () => {
    const ids = await searchBlocks([
      chunk("e1", "f1", 1, 20, "2026-01-01T00:00:00.000Z"),
      chunk("e2", "f1", 4, 8, "2026-01-02T00:00:00.000Z"),
    ]);

    expect(ids).toEqual(["e1"]);
  });
});

describe("语义检索结果的排序", () => {
  // b_new 最新、b_old 最旧；rerank 判定 b_new 更相关
  const ORDERED_BLOCKS = [
    chunk("b_old", "f1", 1, 5, "2026-01-01T00:00:00.000Z"),
    chunk("b_new", "f1", 40, 45, "2026-01-09T00:00:00.000Z"),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    findByIdsMock.mockReturnValue(ORDERED_BLOCKS);
    searchBlockEmbeddingsMock.mockResolvedValue(
      ORDERED_BLOCKS.map((block) => ({ item: { block_id: block.id }, score: 1 })),
    );
  });

  it("按 rerank 相关性顺序返回，不再被 created_at 重排覆盖", async () => {
    rerankMock.mockResolvedValue([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.2 },
    ]);

    const results = await chunkService.searchAll("排序", 10, SEARCH_TYPE.SEMANTIC);

    expect(results.map((r) => r.id)).toEqual(["b_new", "b_old"]);
  });
});

describe("语义检索遵守入参 limit", () => {
  /** 生成 count 个两两不相交的行区间块，避免条数被重叠去重吃掉 */
  function chunkRun(count: number): Chunk[] {
    return Array.from({ length: count }, (_, i) =>
      chunk(`x${i}`, "f1", i * 10 + 1, i * 10 + 5, "2026-01-01T00:00:00.000Z"),
    );
  }

  async function search(limit: number, candidateCount: number): Promise<string[]> {
    const blocks = chunkRun(candidateCount);
    findByIdsMock.mockReturnValue(blocks);
    searchBlockEmbeddingsMock.mockResolvedValue(
      blocks.map((block) => ({ item: { block_id: block.id }, score: 1 })),
    );
    rerankMock.mockImplementation(
      async (_keyword: string, texts: string[]) =>
        texts.map((_, index) => ({ index, score: 1 - index * 0.01 })),
    );
    const results = await chunkService.searchAll("limit", limit, SEARCH_TYPE.SEMANTIC);
    return results.map((result) => result.id);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回条数等于 limit，不再硬截断为 10", async () => {
    expect(await search(25, 30)).toEqual(
      Array.from({ length: 25 }, (_, i) => `x${i}`),
    );
  });

  it("limit 变大只加深召回，不放大重排输入", async () => {
    await search(25, 30);
    expect(searchBlockEmbeddingsMock.mock.calls[0][0].topK).toBe(100);

    await search(5, 30);
    // 召回下限沿用历史的固定 50，小 limit 时不因缩放而变薄
    expect(searchBlockEmbeddingsMock.mock.calls[1][0].topK).toBe(50);
    expect(rerankMock.mock.calls[1][1]).toHaveLength(30);
  });

  it("召回超出重排规模时，只把前 50 条送去重排", async () => {
    await search(50, 200);
    expect(searchBlockEmbeddingsMock.mock.calls[0][0].topK).toBe(200);
    expect(rerankMock.mock.calls[0][1]).toHaveLength(50);
  });

  it("返回条数封顶在重排规模，不随 limit 无限增长", async () => {
    expect(await search(200, 200)).toHaveLength(50);
  });

  it("非正值 limit 退化为 1 条", async () => {
    expect(await search(0, 3)).toEqual(["x0"]);
  });
});
