// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  collectChunks,
  hasRefineTargets,
  refineDocument,
  splitDocument,
  thresholdForChunkType,
} from "@/main/core/services/content/chunk-splitter";
import type { SentenceEmbedder } from "@/main/core/services/content/splitting/types";

/**
 * 4 句（向量检索）+ 3 句（前端渲染），整块 587 字符越过 L2 的 500 字符预算：
 * 真实语义边界在第 4/5 行之间，而长度装箱会把边界放到第 5/6 行之间。
 */
const MD = [
  ...[1, 2, 3, 4].map((i) => `向量第${i}句：${"检索要点".repeat(23)}。`),
  ...[5, 6, 7].map((i) => `前端渲染：${"编辑器".repeat(28)}第${i}句。`),
].join("\n");

/** 按行首话题给两个正交向量 */
const twoTopics: SentenceEmbedder = async (texts) =>
  texts.map((text) => (text.startsWith("向量") ? [1, 0] : [0, 1]));

/** 所有句子同一向量：没有语义低谷，L3 应当放弃改边界 */
const flat: SentenceEmbedder = async (texts) => texts.map(() => [1, 0]);

describe("L3 语义边界优化", () => {
  it("在相似度低谷处切分，替代长度决定的边界", async () => {
    const result = splitDocument(MD);
    expect(hasRefineTargets(result)).toBe(true);

    const refined = await refineDocument(
      result,
      twoTopics,
      thresholdForChunkType("journal"),
    );

    expect(refined).toHaveLength(2);
    expect(refined.every((chunk) => chunk.layer === "semantic")).toBe(true);
    expect(refined[0].endLine).toBe(4);
    expect(refined[1].startLine).toBe(5);
    // L2 的边界由长度决定，与语义边界不重合
    expect(collectChunks(result.segments)[0].endLine).not.toBe(4);
  });

  it("精修后的块不再彼此重叠，也不吞行", async () => {
    const result = splitDocument(MD);
    const refined = await refineDocument(result, twoTopics, 0.75);

    for (let i = 1; i < refined.length; i++) {
      expect(refined[i].startLine).toBe(refined[i - 1].endLine + 1);
    }
  });

  it("语义段仍超预算时段内退化为句子装箱，但不跨话题", async () => {
    const longMd = [
      ...[1, 2, 3, 4, 5, 6].map((i) => `向量检索：${"分块".repeat(40)}第${i}句。`),
      ...[7, 8, 9].map((i) => `前端渲染：${"编辑器".repeat(40)}第${i}句。`),
    ].join("\n");
    const result = splitDocument(longMd);
    const refined = await refineDocument(result, twoTopics, 0.75);

    expect(refined.length).toBeGreaterThan(2);
    for (const chunk of refined) {
      // 装箱只发生在语义段内部，不会跨过低谷把两个话题并进一块
      const isVector = chunk.content.includes("向量检索");
      const isFrontend = chunk.content.includes("前端渲染");
      expect(isVector !== isFrontend).toBe(true);
    }
  });

  it("未发现低谷时保留 L2 结果", async () => {
    const result = splitDocument(MD);
    const refined = await refineDocument(result, flat, 0.75);

    expect(refined).toEqual(collectChunks(result.segments));
  });

  it("推理失败逐段降级，不整体回退", async () => {
    const failing: SentenceEmbedder = async () => {
      throw new Error("模型未加载");
    };
    const result = splitDocument(MD);
    const refined = await refineDocument(result, failing, 0.75);

    expect(refined).toEqual(collectChunks(result.segments));
  });

  it("阈值按体裁区分：日志/技术类高于叙事/思考类", () => {
    expect(thresholdForChunkType("journal")).toBeGreaterThan(
      thresholdForChunkType("page"),
    );
    expect(thresholdForChunkType("reflection")).toBe(thresholdForChunkType("page"));
  });
});
