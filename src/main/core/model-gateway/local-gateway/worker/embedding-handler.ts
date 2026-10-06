/**
 * Worker 嵌入模型推理 handler
 */
import type { FeatureExtractionPipeline, Tensor } from "@xenova/transformers";
import type { TransformersModelPaths } from "../types";

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let embeddingModelName = "Xenova/bge-m3";

export async function load(config?: {
  modelName?: string;
  transformers?: TransformersModelPaths;
}): Promise<{ modelName: string }> {
  if (config?.modelName) embeddingModelName = config.modelName;
  const { pipeline, env } = await import("@xenova/transformers");

  const paths = config?.transformers;
  if (paths) {
    // 强制从本地下载目录读取：关闭远程回退并指定本地模型根目录
    env.allowRemoteModels = false;
    env.localModelPath = paths.modelRoot;
  }

  embeddingPipeline = await pipeline(
    "feature-extraction",
    paths?.modelDir ?? embeddingModelName,
    paths ? { quantized: false, model_file_name: paths.modelFileName } : undefined,
  ) as FeatureExtractionPipeline;

  return { modelName: paths?.modelDir ?? embeddingModelName };
}

export async function embed(text: string, pooling?: "mean" | "cls" | "none", normalize?: boolean): Promise<{ vector: number[]; dimension: number }> {
  if (!embeddingPipeline) throw new Error("嵌入模型未加载");
  const output: Tensor = await embeddingPipeline(text, {
    pooling: pooling ?? "mean",
    normalize: normalize ?? true,
  });
  const vector = Array.from(output.data as Float32Array);
  return { vector, dimension: vector.length };
}

export async function embedBatch(
  texts: string[],
  pooling?: "mean" | "cls" | "none",
  normalize?: boolean,
): Promise<{ vector: number[]; dimension: number }[]> {
  if (!embeddingPipeline) throw new Error("嵌入模型未加载");
  if (texts.length === 0) return [];

  // 一次数组推理：transformers.js 对数组输入返回 [batch, dim] 的 Tensor
  const output = (await embeddingPipeline(texts, {
    pooling: pooling ?? "mean",
    normalize: normalize ?? true,
  })) as Tensor;

  const flat = output.data as Float32Array;
  const dims = output.dims;
  const dimension =
    dims.length > 1 ? dims[dims.length - 1] : flat.length / texts.length;

  const results: { vector: number[]; dimension: number }[] = [];
  for (let i = 0; i < texts.length; i++) {
    const start = i * dimension;
    results.push({
      vector: Array.from(flat.slice(start, start + dimension)),
      dimension,
    });
  }
  return results;
}

export async function unload(): Promise<void> {
  if (embeddingPipeline) {
    await embeddingPipeline.dispose?.();
    embeddingPipeline = null;
  }
}