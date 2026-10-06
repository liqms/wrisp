// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { splitMarkdown, splitDocument } from "@/main/core/services/content/chunk-splitter";

const MD = [
  "# 周记录", // 1
  "本周整体顺利。", // 2
  "", // 3
  "## 排期讨论", // 4
  "对齐了三个里程碑。", // 5
  "", // 6
  "2026-10-06 09:30", // 7
  "晨会：确认接口冻结时间。", // 8
  "", // 9
  ":::metric", // 10
  "label: DAU", // 11
  "value: 12k", // 12
  ":::", // 13
  "", // 14
  "```markdown", // 15
  "# 这不是标题", // 16
  "```", // 17
  "结尾说明。", // 18
].join("\n");

describe("L1 结构感知切分", () => {
  it("标题、时间戳行、围栏各成独立粗块", () => {
    const chunks = splitMarkdown(MD);

    expect(chunks.map((c) => c.startLine)).toEqual([1, 4, 7, 10, 15]);
    expect(chunks.map((c) => c.endLine)).toEqual([2, 5, 8, 13, 18]);
  });

  it("块正文与原文行区间逐字一致，且不吞掉代码围栏", () => {
    const chunks = splitMarkdown(MD);
    const lines = MD.split("\n");

    for (const chunk of chunks) {
      const expected = lines.slice(chunk.startLine - 1, chunk.endLine).join("\n");
      expect(chunk.content).toBe(expected);
    }

    const codeBlock = chunks.find((c) => c.startLine === 15);
    expect(codeBlock?.content).toContain("# 这不是标题");
    // 代码块里的 # 不应被当成标题
    expect(chunks.every((c) => c.sectionTitle !== "这不是标题")).toBe(true);
  });

  it("::: 自定义块作为原子单元保留，且不被登记为语义精修目标", () => {
    const result = splitDocument(MD);
    const fence = splitMarkdown(MD).find((c) => c.content.startsWith(":::metric"));

    expect(fence?.content).toBe(":::metric\nlabel: DAU\nvalue: 12k\n:::");
    expect(result.segments.filter((s) => s.target !== null)).toHaveLength(0);
  });

  it("未闭合围栏降级为普通文本，不吞掉后续内容", () => {
    const chunks = splitMarkdown(":::metric\nlabel: DAU\n\n正文段落。");

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("正文段落。");
  });
});
