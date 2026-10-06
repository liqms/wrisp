// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const updateMock = vi.fn();
const chatCompletionMock = vi.fn();
const getLlmConcurrencyMock = vi.fn(() => 2);
const findByTitleMock = vi.fn(() => null);
const conceptCreateMock = vi.fn(() => "c1");
const findByIdMock = vi.fn(() => ({ id: "c1", title: "a" }));
const conceptChunkCreateMock = vi.fn();

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    update = updateMock;
  },
}));
vi.mock("@/main/core/db/concept.dao", () => ({
  conceptDao: {
    findByTitle: (...a: unknown[]) => findByTitleMock(...a),
    create: (...a: unknown[]) => conceptCreateMock(...a),
    findById: (...a: unknown[]) => findByIdMock(...a),
  },
}));
vi.mock("@/main/core/db/conceptChunk.dao", () => ({
  conceptChunkDao: {
    create: (...a: unknown[]) => conceptChunkCreateMock(...a),
  },
}));
vi.mock("@/main/core/services/ai/ai.service", () => ({
  aiService: {
    chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
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

describe("ConceptExtractExecutor 有界并发", () => {
  beforeEach(() => {
    queryMock.mockReset();
    updateMock.mockReset();
    chatCompletionMock.mockReset();
    getLlmConcurrencyMock.mockReset().mockReturnValue(2);
  });

  it("并发不超过 context 池大小且全部块被处理", async () => {
    queryMock.mockReturnValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `b${i}`,
        content: "text",
        ai_summary: "summary text",
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    );
    let active = 0;
    let maxObserved = 0;
    chatCompletionMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return { content: "a, b" };
    });

    const executor = new ConceptExtractExecutor();
    const result = await executor.run({
      executionId: "e1",
      processedUntil: null,
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(5);
    expect(maxObserved).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(5);
  });
});