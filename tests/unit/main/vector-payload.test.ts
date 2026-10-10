import { describe, it, expect } from "vitest";
import {
  buildChunkEmbeddings,
  buildPageEmbeddingText,
  buildPageEmbeddings,
} from "@/main/core/vector/vector-payload";

describe("buildChunkEmbeddings", () => {
  it("为每条向量带上对应作品的 project_id", () => {
    const batch = [{ id: "c1" }, { id: "c2" }];
    const vectors = [
      [0, 1],
      [1, 0],
    ];
    const result = buildChunkEmbeddings(batch, vectors, (id) =>
      id === "c1" ? "p1" : null,
    );
    expect(result).toEqual([
      { chunk_id: "c1", project_id: "p1", embedding: [0, 1] },
      { chunk_id: "c2", project_id: null, embedding: [1, 0] },
    ]);
  });
});

describe("buildPageEmbeddingText", () => {
  it("摘要优先", () => {
    expect(buildPageEmbeddingText({ title: "标题", ai_summary: "页面摘要" })).toBe(
      "页面摘要",
    );
  });

  it("空摘要回退标题", () => {
    expect(buildPageEmbeddingText({ title: "标题", ai_summary: null })).toBe("标题");
    expect(buildPageEmbeddingText({ title: "标题", ai_summary: "   " })).toBe("标题");
  });
});

describe("buildPageEmbeddings", () => {
  it("为每条向量带上页面的 project_id（可空）", () => {
    const batch = [
      { id: "p1", project_id: "proj-1" },
      { id: "p2", project_id: null },
    ];
    const vectors = [
      [0, 1],
      [1, 0],
    ];
    const result = buildPageEmbeddings(batch, vectors);
    expect(result).toEqual([
      { page_id: "p1", project_id: "proj-1", embedding: [0, 1] },
      { page_id: "p2", project_id: null, embedding: [1, 0] },
    ]);
  });
});
