import { describe, it, expect } from "vitest";
import type {
  BlockEmbedding,
  BlockEmbeddingCreate,
} from "@/main/types/db/vector.types";

// 类型契约测试：运行时断言恒真，行为回归不会在此失败。不计入行为覆盖。

describe("BlockEmbedding 类型", () => {
  it("允许携带 project_id", () => {
    const data: BlockEmbeddingCreate = {
      block_id: "b1",
      project_id: "p1",
      embedding: [0, 1],
    };
    const row: BlockEmbedding = { ...data };
    expect(row.project_id).toBe("p1");
  });
});
