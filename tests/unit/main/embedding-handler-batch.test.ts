// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const pipelineMock = vi.fn();
const extractMock = vi.fn();

vi.mock("@xenova/transformers", () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { allowRemoteModels: true, localModelPath: "" },
}));

import {
  load,
  embedBatch,
  unload,
} from "@/main/core/model-gateway/local-gateway/worker/embedding-handler";

describe("embedding-handler 真批量", () => {
  it("AC5：embedBatch 对一批文本仅调用一次推理并按序切分", async () => {
    pipelineMock.mockResolvedValue(extractMock);
    extractMock.mockResolvedValue({
      data: new Float32Array([1, 2, 3, 4, 5, 6]),
      dims: [2, 3],
    });
    await load({ modelName: "test-model" });

    const results = await embedBatch(["a", "b"]);

    expect(extractMock).toHaveBeenCalledTimes(1);
    expect(extractMock.mock.calls[0][0]).toEqual(["a", "b"]);
    expect(results).toHaveLength(2);
    expect(results[0].vector).toEqual([1, 2, 3]);
    expect(results[1].vector).toEqual([4, 5, 6]);
    expect(results[0].dimension).toBe(3);

    await unload();
  });

  it("空数组返回空结果且不调用推理", async () => {
    pipelineMock.mockResolvedValue(extractMock);
    await load({ modelName: "test-model" });
    extractMock.mockClear();

    const results = await embedBatch([]);

    expect(results).toEqual([]);
    expect(extractMock).not.toHaveBeenCalled();
    await unload();
  });
});