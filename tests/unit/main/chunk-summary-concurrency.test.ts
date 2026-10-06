// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const updateMock = vi.fn();
const chatCompletionMock = vi.fn();
const getLlmConcurrencyMock = vi.fn(() => 2);

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    update = updateMock;
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

import { ChunkSummaryExecutor } from "@/main/core/smart-tasks/executors/chunk-summary.executor";

function makeBlocks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    content: "x".repeat(300),
    ai_summary: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  }));
}

describe("ChunkSummaryExecutor 有界并发", () => {
  beforeEach(() => {
    queryMock.mockReset();
    updateMock.mockReset();
    chatCompletionMock.mockReset();
    getLlmConcurrencyMock.mockReset().mockReturnValue(2);
  });

  it("AC4：本地并发数达到 context 池大小且写入不串数据", async () => {
    queryMock.mockReturnValue(makeBlocks(5));
    let active = 0;
    let maxObserved = 0;
    chatCompletionMock.mockImplementation(async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return { content: "summary" };
    });

    const executor = new ChunkSummaryExecutor();
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

  it("AC7：取消后不再启动新项并返回已取消", async () => {
    queryMock.mockReturnValue(makeBlocks(4));
    getLlmConcurrencyMock.mockReturnValue(1);
    const cancelSignal = { cancelled: false };
    chatCompletionMock.mockImplementation(async () => {
      cancelSignal.cancelled = true;
      await new Promise((r) => setTimeout(r, 5));
      return { content: "summary" };
    });

    const executor = new ChunkSummaryExecutor();
    const result = await executor.run({
      executionId: "e2",
      processedUntil: null,
      cancelSignal,
      pauseSignal: { paused: false },
    });

    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("已取消");
  });
});