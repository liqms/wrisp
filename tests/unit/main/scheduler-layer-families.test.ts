// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  collectLayerFamilies,
  selectReleasableFamilies,
} from "@/main/core/smart-tasks/task-dag";

describe("collectLayerFamilies", () => {
  it("收集层内 family，去重并按固定执行顺序排列", () => {
    expect(
      collectLayerFamilies([
        "semantic-link",
        "concept-extract",
        "chunk-summary",
      ]),
    ).toEqual(["reranker", "llm"]);
  });

  it("无模型任务不产生 family", () => {
    expect(collectLayerFamilies(["topic-detection"])).toEqual([]);
  });

  it("同一层三类 family 全出现时按 embedding → reranker → llm", () => {
    expect(
      collectLayerFamilies([
        "chunk-summary",
        "chunk-vectorize",
        "semantic-link",
      ]),
    ).toEqual(["embedding", "reranker", "llm"]);
  });
});

describe("selectReleasableFamilies", () => {
  it("剩余任务不再需要该 family 时可释放", () => {
    expect(selectReleasableFamilies(["llm"], ["chunk-vectorize"])).toEqual([
      "llm",
    ]);
  });

  it("剩余任务仍需要该 family 时不释放", () => {
    expect(selectReleasableFamilies(["llm"], ["topic-summary"])).toEqual([]);
  });

  it("保持传入顺序", () => {
    expect(
      selectReleasableFamilies(
        ["embedding", "reranker", "llm"],
        ["topic-detection"],
      ),
    ).toEqual(["embedding", "reranker", "llm"]);
  });
});