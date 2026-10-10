// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const updateMock = vi.fn();
const recordStageMock = vi.fn();
const chatCompletionMock = vi.fn();
const getLlmConcurrencyMock = vi.fn(() => 2);

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  ChunkDao: class {
    query = queryMock;
    update = updateMock;
    recordStage = recordStageMock;
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
    // 必须是「剥掉 Markdown 后仍有正文」的内容，否则会命中跳过分支而不调模型
    content: "本周整理了向量检索的切分边界问题并复盘了原因。".repeat(12),
    ai_summary: null,
    updated_at: "2026-01-01T00:00:00.000Z",
  }));
}

describe("ChunkSummaryExecutor 有界并发", () => {
  beforeEach(() => {
    queryMock.mockReset();
    updateMock.mockReset();
    recordStageMock.mockReset();
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
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(5);
    expect(maxObserved).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(5);
    expect(recordStageMock).toHaveBeenCalledTimes(5);
  });

  it("失败条目不写标记、单列 failedCount，下一轮靠选取条件自愈（§3.7）", async () => {
    queryMock.mockReturnValue(makeBlocks(3));
    chatCompletionMock
      .mockRejectedValueOnce(new Error("模型未就绪"))
      .mockResolvedValue({ content: "summary" });

    const result = await new ChunkSummaryExecutor().run({
      executionId: "e3",
      cancelSignal: { cancelled: false },
      pauseSignal: { paused: false },
    });

    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    // 失败块既不写摘要也不写标记：下一轮仍会被标记列选中
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(recordStageMock).toHaveBeenCalledTimes(2);
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
      cancelSignal,
      pauseSignal: { paused: false },
    });

    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.error).toBe("已取消");
  });
});