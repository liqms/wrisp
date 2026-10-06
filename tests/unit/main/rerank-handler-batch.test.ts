// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const pipelineMock = vi.fn();
const classifyMock = vi.fn();

vi.mock("@xenova/transformers", () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { allowRemoteModels: true, localModelPath: "" },
}));

import {
  load,
  rerank,
  unload,
} from "@/main/core/model-gateway/local-gateway/worker/rerank-handler";

describe("rerank-handler 真批量", () => {
  it("rerank 对一批文档仅调用一次推理并按分数降序返回", async () => {
    pipelineMock.mockResolvedValue(classifyMock);
    classifyMock.mockResolvedValue([
      [{ label: "LABEL_0", score: 0.2 }],
      [{ label: "LABEL_0", score: 0.9 }],
    ]);
    await load({ modelName: "test-reranker" });

    const results = await rerank("q", ["doc-a", "doc-b"]);

    expect(classifyMock).toHaveBeenCalledTimes(1);
    expect(classifyMock.mock.calls[0][0]).toEqual([
      "q [SEP] doc-a",
      "q [SEP] doc-b",
    ]);
    expect(results).toEqual([
      { index: 1, score: 0.9 },
      { index: 0, score: 0.2 },
    ]);

    await unload();
  });

  it("空文档列表返回空结果且不调用推理", async () => {
    pipelineMock.mockResolvedValue(classifyMock);
    await load({ modelName: "test-reranker" });
    classifyMock.mockClear();

    const results = await rerank("q", []);

    expect(results).toEqual([]);
    expect(classifyMock).not.toHaveBeenCalled();
    await unload();
  });
});