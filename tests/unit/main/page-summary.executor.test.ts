// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  pageQuery: vi.fn(() => []),
  pageUpdate: vi.fn(),
  recordStage: vi.fn(),
  chunkQuery: vi.fn(() => []),
  findByFilePath: vi.fn(),
  chatCompletion: vi.fn(),
  readFile: vi.fn(),
  exists: vi.fn(() => true),
}));

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/db", () => ({
  PageDao: class {
    query = m.pageQuery;
    update = m.pageUpdate;
    recordStage = m.recordStage;
  },
  ChunkDao: class {
    query = m.chunkQuery;
  },
  FileIndexDao: class {
    findByFilePath = m.findByFilePath;
  },
}));
vi.mock("@/main/core/services/ai/ai.service", () => ({
  aiService: { chatCompletion: m.chatCompletion },
}));
vi.mock("@/main/core/services/base/file.service", () => ({
  fileService: { exists: m.exists, readFile: m.readFile },
}));
vi.mock("@/main/core/model-gateway/local-gateway", () => ({
  localAiManager: { getLlmConcurrency: () => 1 },
}));
vi.mock("@/main/core/smart-tasks/progress.manager", () => ({
  progressManager: { update: vi.fn() },
}));

import { PageSummaryExecutor } from "@/main/core/smart-tasks/executors/page-summary.executor";

const TS = "2026-01-01T00:00:00.000Z";

function page(id: string) {
  return {
    id,
    project_id: "proj-1",
    title: `标题-${id}`,
    file_path: `/tmp/${id}.md`,
    order_index: 0,
    parent_page_id: null,
    word_count: 100,
    ai_summary: null,
    metadata: "{}",
    status: "active",
    page_type: "project_chapter",
    last_smart_processed_at: null,
    last_summary_generated_at: null,
    last_vectorized_at: null,
    created_at: TS,
    updated_at: TS,
  };
}

const LONG_PROSE = "这是一段足够长的页面正文。".repeat(30);

function context() {
  return { executionId: "e1", cancelSignal: { cancelled: false }, pauseSignal: { paused: false } };
}

describe("PageSummaryExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.pageQuery.mockReturnValue([]);
    m.chunkQuery.mockReturnValue([]);
    m.findByFilePath.mockReturnValue(null);
    m.exists.mockReturnValue(true);
    m.readFile.mockReturnValue(LONG_PROSE);
    m.chatCompletion.mockResolvedValue({ content: "页面摘要" });
  });

  it("按 last_summary_generated_at 增量选取 pending 页面", async () => {
    await new PageSummaryExecutor().run(context());
    const sql = m.pageQuery.mock.calls[0][0] as string;
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("last_summary_generated_at IS NULL OR updated_at > last_summary_generated_at");
  });

  it("成功时写摘要并落两列标记", async () => {
    m.pageQuery.mockReturnValue([page("p1")]);

    const result = await new PageSummaryExecutor().run(context());

    expect(m.pageUpdate).toHaveBeenCalledWith("p1", { ai_summary: "页面摘要" });
    expect(m.recordStage).toHaveBeenCalledWith("p1", [
      "last_summary_generated_at",
      "last_smart_processed_at",
    ]);
    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it("模型空产出时不写摘要也不写标记（下一轮自然重试）", async () => {
    m.pageQuery.mockReturnValue([page("p1")]);
    m.chatCompletion.mockResolvedValue({ content: "" });

    const result = await new PageSummaryExecutor().run(context());

    expect(m.pageUpdate).not.toHaveBeenCalled();
    expect(m.recordStage).not.toHaveBeenCalled();
    expect(result.failedCount).toBe(1);
    expect(result.processedCount).toBe(0);
  });

  it("输入文本优先聚合本页各块的 ai_summary", async () => {
    m.pageQuery.mockReturnValue([page("p1")]);
    m.findByFilePath.mockReturnValue({ id: "file-1" });
    // 足够长（> 200 字符）才会走模型路径，从 prompt 里反证聚合结果进了输入
    const summaryOne = "块摘要一".repeat(60);
    const summaryTwo = "块摘要二".repeat(60);
    m.chunkQuery.mockReturnValue([
      { id: "c1", ai_summary: summaryOne, start_line: 1 },
      { id: "c2", ai_summary: summaryTwo, start_line: 10 },
    ]);

    await new PageSummaryExecutor().run(context());

    const prompt = m.chatCompletion.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain(summaryOne);
    expect(prompt).toContain(summaryTwo);
    expect(m.readFile).not.toHaveBeenCalled();
  });

  it("无正文可摘要时跳过并写标记，不调模型", async () => {
    m.pageQuery.mockReturnValue([page("p1")]);
    m.readFile.mockReturnValue("```\nconst a = 1;\n```");

    const result = await new PageSummaryExecutor().run(context());

    expect(m.chatCompletion).not.toHaveBeenCalled();
    expect(m.pageUpdate).not.toHaveBeenCalled();
    expect(m.recordStage).toHaveBeenCalledWith("p1", [
      "last_summary_generated_at",
      "last_smart_processed_at",
    ]);
    expect(result.processedCount).toBe(1);
  });
});
