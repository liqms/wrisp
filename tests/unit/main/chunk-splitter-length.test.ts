// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  splitDocument,
  splitMarkdown,
} from "@/main/core/services/content/chunk-splitter";
import { CHUNK_MAX_COARSE_CHARS } from "@/main/constants";

/** 每条 82 字符，8 条共 660+ 字符，明确越过 L2 的 500 字符上限 */
const line = (i: number): string => `${"要点".repeat(40)}第${i}条。`;

describe("L2 长度约束切分", () => {
  it("超阈值块按句子边界切开，相邻块保留句子重叠", () => {
    const md = Array.from({ length: 8 }, (_, i) => line(i + 1)).join("\n");
    const chunks = splitMarkdown(md);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX_COARSE_CHARS);
    }
    // 第 1、2 块共享若干行：重叠区把上下文带进下一块
    expect(chunks[1].startLine).toBeLessThanOrEqual(chunks[0].endLine);
    expect(chunks[1].startLine).toBeGreaterThan(chunks[0].startLine);
  });

  it("整段无终止符时按行硬切，长度仍有上界", () => {
    const md = Array.from({ length: 20 }, () => "连续书写的中文内容".repeat(4)).join("\n");
    const chunks = splitMarkdown(md);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_MAX_COARSE_CHARS);
    }
  });

  it(": 自定义块围栏是原子块，再长也不切", () => {
    const fields = Array.from(
      { length: 30 },
      (_, i) => `label${i}: ${"取值".repeat(20)}`,
    ).join("\n");
    const chunks = splitMarkdown(`:::metric\n${fields}\n:::`);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content.startsWith(":::metric")).toBe(true);
    expect(chunks[0].content.length).toBeGreaterThan(CHUNK_MAX_COARSE_CHARS);
  });

  it("长度切分的块登记为 L3 精修目标，结构块不登记", () => {
    const md = Array.from({ length: 8 }, (_, i) => line(i + 1)).join("\n");
    const result = splitDocument(md);

    expect(result.stats).toEqual({ coarse: 1, refined: 1 });

    const short = splitDocument("短段落一句。\n另一段一句。");
    expect(short.stats.refined).toBe(0);
  });

  it("切分结果覆盖原块全部行，不吞内容", () => {
    const md = Array.from({ length: 8 }, (_, i) => line(i + 1)).join("\n");
    const chunks = splitMarkdown(md);

    expect(chunks[0].startLine).toBe(1);
    expect(chunks[chunks.length - 1].endLine).toBe(8);
  });
});
