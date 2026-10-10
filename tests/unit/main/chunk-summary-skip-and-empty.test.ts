// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
const updateMock = vi.fn();
const recordStageMock = vi.fn();
const chatCompletionMock = vi.fn();
const getLlmConcurrencyMock = vi.fn(() => 1);

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

/** 足够长的中文正文：既过 200 字符短路阈值，也过正文字数阈值 */
const PROSE = "本周把向量检索的召回链路重写了一遍，主要问题是切分边界不稳定。".repeat(8);

function makeBlock(content: string, id = "b1") {
  return {
    id,
    content,
    ai_summary: null,
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

function run(blocks: unknown[]) {
  queryMock.mockReturnValue(blocks);
  return new ChunkSummaryExecutor().run({
    executionId: "e1",
    cancelSignal: { cancelled: false },
    pauseSignal: { paused: false },
  });
}

describe("ChunkSummaryExecutor 空值与非正文块", () => {
  beforeEach(() => {
    queryMock.mockReset();
    updateMock.mockReset();
    recordStageMock.mockReset();
    chatCompletionMock.mockReset();
    getLlmConcurrencyMock.mockReset().mockReturnValue(1);
  });

  it("代码围栏块：不调模型、不写摘要，只补阶段标记", async () => {
    const result = await run([
      makeBlock("```ts\nconst a = 1;\nconsole.log(a);\nfor (let i = 0; i < 3; i++) {}\n```"),
    ]);

    expect(chatCompletionMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(recordStageMock).toHaveBeenCalledWith("b1", [
      "last_summary_generated_at",
      "last_smart_processed_at",
    ]);
    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.summary?.skippedCount).toBe(1);
  });

  it("mermaid 围栏块同样跳过（此前会把围栏原文写成摘要）", async () => {
    await run([makeBlock(":::mermaid\ngraph TD;\nA-->B;\nB-->C;\nC-->D;\n:::")]);

    expect(updateMock).not.toHaveBeenCalled();
    expect(recordStageMock).toHaveBeenCalledWith("b1", [
      "last_summary_generated_at",
      "last_smart_processed_at",
    ]);
  });

  it("模型返回空串按失败处理：既不写摘要也不写标记", async () => {
    chatCompletionMock.mockResolvedValue({ content: "  \n " });

    const result = await run([makeBlock(PROSE)]);

    expect(updateMock).not.toHaveBeenCalled();
    expect(recordStageMock).not.toHaveBeenCalled();
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(1);
  });

  it("正常摘要先写内容再写标记，避免把自己的水位线顶到标记之后", async () => {
    chatCompletionMock.mockResolvedValue({ content: "改写后的摘要" });

    const result = await run([makeBlock(PROSE, "b1"), makeBlock(PROSE, "b2")]);

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(recordStageMock).toHaveBeenCalledTimes(2);
    expect(updateMock.mock.invocationCallOrder[0]).toBeLessThan(
      recordStageMock.mock.invocationCallOrder[0],
    );
    expect(result.summary?.skippedCount).toBe(0);
  });

  it("选取条件改用专用标记列，不再以 ai_summary 是否为空判增量", async () => {
    await run([]);

    const sql = (queryMock.mock.calls[0] ?? [""])[0] as string;
    expect(sql).toContain("last_summary_generated_at IS NULL");
    expect(sql).toContain("updated_at > last_summary_generated_at");
    expect(sql).not.toContain("ai_summary");
    // 也不再叠加上轮的 processed_until 水位：它会跳过上一轮之后新出现的块
    expect(sql).not.toContain("processed_until");
  });
});
