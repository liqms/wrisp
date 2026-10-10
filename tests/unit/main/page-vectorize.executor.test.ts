// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  pageQuery: vi.fn(() => []),
  recordStageBatch: vi.fn(),
  createPageEmbeddings: vi.fn(),
  embedBatch: vi.fn(),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  PageDao: class {
    query = m.pageQuery;
    recordStageBatch = m.recordStageBatch;
  },
}));
vi.mock("@/main/core/services/ai/vector.service", () => ({
  vectorService: { createPageEmbeddings: m.createPageEmbeddings },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localGateway: { embedBatch: m.embedBatch },
}));
vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn() },
}));

import { PageVectorizeExecutor } from "@/main/core/smart-tasks/executors/page-vectorize.executor";

const TS = "2026-01-01T00:00:00.000Z";

function page(id: string, aiSummary: string | null) {
  return {
    id,
    project_id: "proj-1",
    title: `标题-${id}`,
    file_path: `/tmp/${id}.md`,
    order_index: 0,
    parent_page_id: null,
    word_count: 100,
    ai_summary: aiSummary,
    metadata: "{}",
    status: "active",
    page_type: "project_chapter",
    last_smart_processed_at: TS,
    last_summary_generated_at: TS,
    last_vectorized_at: null,
    created_at: TS,
    updated_at: TS,
  };
}

function context() {
  return { executionId: "e1", cancelSignal: { cancelled: false }, pauseSignal: { paused: false } };
}

describe("PageVectorizeExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.pageQuery.mockReturnValue([]);
    m.embedBatch.mockResolvedValue([{ vector: [0.1, 0.2] }]);
    m.createPageEmbeddings.mockResolvedValue(undefined);
  });

  it("以上游摘要标记为门槛、按 last_vectorized_at 增量选取待向量化页面", async () => {
    await new PageVectorizeExecutor().run(context());
    const sql = m.pageQuery.mock.calls[0][0] as string;
    expect(sql).toContain("last_summary_generated_at IS NOT NULL");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("last_vectorized_at IS NULL OR updated_at > last_vectorized_at");
  });

  it("成功时写向量并落两列标记", async () => {
    m.pageQuery.mockReturnValue([page("p1", "页面摘要一")]);
    m.embedBatch.mockResolvedValue([{ vector: [0.1, 0.2] }]);

    const result = await new PageVectorizeExecutor().run(context());

    expect(m.createPageEmbeddings).toHaveBeenCalledWith([
      { page_id: "p1", project_id: "proj-1", embedding: [0.1, 0.2] },
    ]);
    expect(m.recordStageBatch).toHaveBeenCalledWith(["p1"], [
      "last_vectorized_at",
      "last_smart_processed_at",
    ]);
    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it("嵌入文本优先取 ai_summary，缺摘要时回退标题", async () => {
    m.pageQuery.mockReturnValue([page("p1", "页面摘要一"), page("p2", null)]);
    m.embedBatch.mockResolvedValue([{ vector: [0.1] }, { vector: [0.2] }]);

    await new PageVectorizeExecutor().run(context());

    expect(m.embedBatch).toHaveBeenCalledWith(["页面摘要一", "标题-p2"]);
  });

  it("失败批不写标记、不计 processed（下一轮重嵌）", async () => {
    m.pageQuery.mockReturnValue([page("p1", "页面摘要一")]);
    m.embedBatch.mockRejectedValue(new Error("embedding down"));

    const result = await new PageVectorizeExecutor().run(context());

    expect(m.createPageEmbeddings).not.toHaveBeenCalled();
    expect(m.recordStageBatch).not.toHaveBeenCalled();
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.success).toBe(true);
  });

  it("无待处理页面时直接返回空结果", async () => {
    const result = await new PageVectorizeExecutor().run(context());

    expect(m.embedBatch).not.toHaveBeenCalled();
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });
});
