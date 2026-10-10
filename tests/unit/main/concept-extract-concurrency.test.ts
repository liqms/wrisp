// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMRequest } from "@/main/core/model-gateway/llm-gateway/types";
import type { ConceptUpsertInput } from "@/main/core/db/concept.dao";
import type { Chunk } from "@/main/types/db";
import type { ChunkStageColumn } from "@/main/core/db/chunk.dao";

const queryMock = vi.fn((_sql: string, _params?: unknown[]): Chunk[] => []);
const recordStageMock = vi.fn(
  (_chunkId: string, _columns: readonly ChunkStageColumn[], _temporalScore?: number): number => 0,
);
const chatCompletionMock = vi.fn(
  async (_request: LLMRequest): Promise<{ content: string }> => ({ content: "[]" }),
);
const getLlmConcurrencyMock = vi.fn((): number => 2);
const recentTitlesMock = vi.fn((_limit: number): string[] => []);
const upsertByTitleKeyMock = vi.fn(
  (_input: ConceptUpsertInput): { id: string; merged: boolean } => ({ id: "c1", merged: false }),
);
const upsertAssociationMock = vi.fn((_conceptId: string, _chunkId: string, _score: number): void => {});
const syncMentionCountMock = vi.fn((_conceptId: string): number => 0);

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    recordStage = recordStageMock;
  },
}));
vi.mock("@/main/core/db/concept.dao", () => ({
  conceptDao: {
    recentTitles: (limit: number) => recentTitlesMock(limit),
    upsertByTitleKey: (input: ConceptUpsertInput) => upsertByTitleKeyMock(input),
    syncMentionCount: (conceptId: string) => syncMentionCountMock(conceptId),
  },
}));
vi.mock("@/main/core/db/conceptChunk.dao", () => ({
  conceptChunkDao: {
    upsertAssociation: (conceptId: string, chunkId: string, score: number) =>
      upsertAssociationMock(conceptId, chunkId, score),
  },
}));
vi.mock("@/main/core/services/ai/ai.service", () => ({
  aiService: {
    chatCompletion: (request: LLMRequest) => chatCompletionMock(request),
  },
  default: {},
}));
vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn(), completeTask: vi.fn() },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localAiManager: { getLlmConcurrency: () => getLlmConcurrencyMock() },
}));

import { ConceptExtractExecutor } from "@/main/core/smart-tasks/executors/concept-extract.executor";

function makeBlocks(count: number): Chunk[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    content: `第 ${i} 段正文，讨论检索增强生成。`,
    ai_summary: "摘要",
    section_title: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  })) as unknown as Chunk[];
}

const json = (concepts: unknown[]) => JSON.stringify(concepts);
const concept = (title: string, confidence = 0.9) => ({ title, aliases: [], evidence: "证据", confidence });

function context() {
  return {
    executionId: "e1",
    cancelSignal: { cancelled: false },
    pauseSignal: { paused: false },
  } as never;
}

/** 取第 n 次落库入参；调用不足时直接报错，免得断言里散落非空判定 */
function upsertInput(n = 0): ConceptUpsertInput {
  const call = upsertByTitleKeyMock.mock.calls[n];
  if (!call) throw new Error(`upsertByTitleKey 调用不足 ${n + 1} 次`);
  return call[0];
}

function llmRequest(n = 0): LLMRequest {
  const call = chatCompletionMock.mock.calls[n];
  if (!call) throw new Error(`chatCompletion 调用不足 ${n + 1} 次`);
  return call[0];
}

describe("ConceptExtractExecutor", () => {
  beforeEach(() => {
    queryMock.mockReset().mockReturnValue(makeBlocks(5));
    recordStageMock.mockReset();
    chatCompletionMock.mockReset();
    getLlmConcurrencyMock.mockReset().mockReturnValue(2);
    recentTitlesMock.mockReset().mockReturnValue([]);
    upsertByTitleKeyMock.mockReset().mockReturnValue({ id: "c1", merged: false });
    upsertAssociationMock.mockReset();
    syncMentionCountMock.mockReset();
  });

  it("并发不超过 LLM 池大小，成功块写概念阶段标记", async () => {
    let active = 0;
    let maxObserved = 0;
    chatCompletionMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return { content: json([concept("检索增强生成")]) };
    });

    const result = await new ConceptExtractExecutor().run(context());

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(5);
    expect(maxObserved).toBe(2);
    expect(recordStageMock).toHaveBeenCalledTimes(5);
    expect(recordStageMock.mock.calls[0]?.[1]).toContain("last_concept_extracted_at");
  });

  it("同轮跨块的同义概念合并成一次 upsert，块关联各自保留", async () => {
    queryMock.mockReturnValue(makeBlocks(2));
    let call = 0;
    chatCompletionMock.mockImplementation(async () => ({
      content: json([concept(call++ === 0 ? "RAG" : "rag", 0.9)]),
    }));

    await new ConceptExtractExecutor().run(context());

    expect(upsertByTitleKeyMock).toHaveBeenCalledTimes(1);
    expect(upsertInput()).toMatchObject({ titleKey: "rag", mentionDelta: 2 });
    expect(upsertAssociationMock).toHaveBeenCalledTimes(2);
  });

  it("块内重复概念取最高把握度，不重复计数", async () => {
    queryMock.mockReturnValue(makeBlocks(1));
    chatCompletionMock.mockResolvedValue({
      content: json([concept("检索增强生成", 0.6), concept("检索增强生成。", 0.95)]),
    });

    await new ConceptExtractExecutor().run(context());

    expect(upsertInput().mentionDelta).toBe(1);
    expect(upsertInput().relevance).toBeCloseTo(0.95);
  });

  it("解析失败的块不写标记列并计入 failedCount，其它块照常（设计 D8 + §3.7）", async () => {
    queryMock.mockReturnValue(makeBlocks(3));
    chatCompletionMock
      .mockResolvedValueOnce({ content: "检索增强生成, 向量数据库" })
      .mockResolvedValue({ content: json([concept("检索增强生成")]) });

    const result = await new ConceptExtractExecutor().run(context());

    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(recordStageMock).toHaveBeenCalledTimes(2);
  });

  it("选取条件用概念专属标记列，不再叠加 processed_until 水位", async () => {
    chatCompletionMock.mockResolvedValue({ content: json([]) });

    await new ConceptExtractExecutor().run(context());

    const sql = (queryMock.mock.calls[0] ?? [""])[0];
    expect(sql).toContain("last_concept_extracted_at IS NULL");
    expect(sql).toContain("updated_at > last_concept_extracted_at");
    expect(sql).not.toContain("last_smart_processed_at");
  });

  it("关联写完后按 concept_chunks 校准 mention_count", async () => {
    queryMock.mockReturnValue(makeBlocks(1));
    chatCompletionMock.mockResolvedValue({ content: json([concept("检索增强生成")]) });

    await new ConceptExtractExecutor().run(context());

    expect(upsertAssociationMock).toHaveBeenCalledTimes(1);
    expect(syncMentionCountMock).toHaveBeenCalledWith("c1");
  });

  it("请求带采样参数并标记为后台任务，不抢交互槽位", async () => {
    chatCompletionMock.mockResolvedValue({ content: json([]) });

    await new ConceptExtractExecutor().run(context());

    const request = llmRequest();
    expect(request).toMatchObject({ temperature: 0.2, background: true });
    expect(request.maxTokens ?? 0).toBeGreaterThan(0);
  });

  it("泛化词概念不落库", async () => {
    queryMock.mockReturnValue(makeBlocks(1));
    chatCompletionMock.mockResolvedValue({
      content: json([concept("方法"), concept("检索增强生成")]),
    });

    await new ConceptExtractExecutor().run(context());

    expect(upsertByTitleKeyMock).toHaveBeenCalledTimes(1);
    expect(upsertInput().title).toBe("检索增强生成");
  });

  it("候选概念池每轮只查一次，块间轮换切片", async () => {
    recentTitlesMock.mockReturnValue(
      Array.from({ length: 50 }, (_, i) => `既有概念${i}`),
    );
    chatCompletionMock.mockResolvedValue({ content: json([]) });

    await new ConceptExtractExecutor().run(context());

    expect(recentTitlesMock).toHaveBeenCalledTimes(1);
    const firstUser = llmRequest(0).messages[1]?.content ?? "";
    const secondUser = llmRequest(1).messages[1]?.content ?? "";
    expect(firstUser).toContain("既有概念0");
    expect(secondUser).toContain("既有概念8");
  });
});
