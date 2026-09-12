import { describe, it, expect } from "vitest";
import { buildBlockEmbeddings } from "@/main/core/vector/vector-payload";

describe("buildBlockEmbeddings", () => {
  it("为每条向量带上对应作品的 project_id", () => {
    const batch = [{ id: "c1" }, { id: "c2" }];
    const vectors = [
      [0, 1],
      [1, 0],
    ];
    const result = buildBlockEmbeddings(batch, vectors, (id) =>
      id === "c1" ? "p1" : null,
    );
    expect(result).toEqual([
      { block_id: "c1", project_id: "p1", embedding: [0, 1] },
      { block_id: "c2", project_id: null, embedding: [1, 0] },
    ]);
  });
});
