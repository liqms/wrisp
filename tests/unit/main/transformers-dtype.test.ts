// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const pipelineMock = vi.fn();

vi.mock("@huggingface/transformers", () => ({
  pipeline: (...args: unknown[]) => pipelineMock(...args),
  env: { allowRemoteModels: true, allowLocalModels: true, localModelPath: "" },
}));

import {
  parseTransformersDtype,
  getTransformersArtifacts,
} from "@/main/core/model-gateway/local-gateway/model-registry";
import * as embeddingHandler from "@/main/core/model-gateway/local-gateway/worker/embedding-handler";
import * as rerankHandler from "@/main/core/model-gateway/local-gateway/worker/rerank-handler";

describe("transformers.js v4 dtype 反查", () => {
  it("已收录后缀按库拼接规则反解为 dtype", () => {
    expect(parseTransformersDtype("model.onnx")).toBe("fp32");
    expect(parseTransformersDtype("model_fp16.onnx")).toBe("fp16");
    expect(parseTransformersDtype("model_int8.onnx")).toBe("int8");
    expect(parseTransformersDtype("model_uint8.onnx")).toBe("uint8");
    expect(parseTransformersDtype("model_quantized.onnx")).toBe("q8");
  });

  it("未收录精度与双后缀一律返回 null，不猜精度", () => {
    // _fp16_fp16 正是同时传 model_file_name + dtype 时库会去加载的文件名
    expect(parseTransformersDtype("model_fp16_fp16.onnx")).toBeNull();
    expect(parseTransformersDtype("model_bnb4.onnx")).toBeNull();
    expect(parseTransformersDtype("model_q4f16.onnx")).toBeNull();
    expect(parseTransformersDtype("sub/model.onnx")).toBeNull();
    expect(parseTransformersDtype("model_fp16.pb")).toBeNull();
  });

  it("内置 transformers 模型解析出 modelDir + dtype", () => {
    expect(getTransformersArtifacts("bge-m3")).toEqual({ modelDir: "bge-m3", dtype: "fp16" });
    expect(getTransformersArtifacts("bge-reranker-v2-m3")).toEqual({
      modelDir: "bge-reranker-v2-m3",
      dtype: "fp16",
    });
  });

  it("非 transformers 后端（GGUF）与未注册模型返回 null", () => {
    expect(getTransformersArtifacts("qwen3.5-4b")).toBeNull();
    expect(getTransformersArtifacts("not-registered")).toBeNull();
  });
});

describe("worker 加载只传 dtype，不传文件名", () => {
  const transformers = {
    modelRoot: "D:/models",
    modelDir: "bge-m3",
    dtype: "fp16" as const,
  };

  it.each([
    ["embedding", embeddingHandler, "feature-extraction"],
    ["reranker", rerankHandler, "text-classification"],
  ] as const)("%s handler 传入 dtype 且不含 model_file_name / quantized", async (_name, handler, task) => {
    pipelineMock.mockResolvedValue({});
    await handler.load({ transformers });

    const [actualTask, modelDir, options] = pipelineMock.mock.calls[0];
    expect(actualTask).toBe(task);
    expect(modelDir).toBe("bge-m3");
    // 用 toMatchObject 而非 toEqual：允许后续新增 session_options 等合法字段，
    // 但仍逐条钉死「不得出现 model_file_name / quantized」
    expect(options).toMatchObject({ dtype: "fp16" });
    expect(options).not.toHaveProperty("model_file_name");
    expect(options).not.toHaveProperty("quantized");
    // 未下发线程预算时不能凭空造出 session_options（那会让 ORT 收到空对象以外的意外配置）
    expect(options).not.toHaveProperty("session_options");

    await handler.unload();
    pipelineMock.mockClear();
  });

  it.each([
    ["embedding", embeddingHandler, "feature-extraction"],
    ["reranker", rerankHandler, "text-classification"],
  ] as const)("%s handler 下发线程预算时以 session_options 传入", async (_name, handler, task) => {
    pipelineMock.mockResolvedValue({});
    await handler.load({ transformers, intraOpNumThreads: 4 });

    const [actualTask, , options] = pipelineMock.mock.calls[0];
    expect(actualTask).toBe(task);
    expect(options).toMatchObject({ dtype: "fp16", session_options: { intraOpNumThreads: 4 } });

    await handler.unload();
    pipelineMock.mockClear();
  });
});
