/**
 * Worker 嵌入模型推理 handler
 */
import type { FeatureExtractionPipeline, Tensor } from "@xenova/transformers";

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let embeddingModelName = "Xenova/jina-embeddings-v3";

export async function load(config?: { modelName?: string }): Promise<void> {
  if (config?.modelName) embeddingModelName = config.modelName;
  const { pipeline } = await import("@xenova/transformers");
  embeddingPipeline = await pipeline("feature-extraction", embeddingModelName) as FeatureExtractionPipeline;
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
  const results: { vector: number[]; dimension: number }[] = [];
  for (const text of texts) {
    const output: Tensor = await embeddingPipeline(text, {
      pooling: pooling ?? "mean",
      normalize: normalize ?? true,
    });
    const vector = Array.from(output.data as Float32Array);
    results.push({ vector, dimension: vector.length });
  }
  return results;
}

export async function unload(): Promise<void> {
  if (embeddingPipeline) {
    await embeddingPipeline.dispose?.();
    embeddingPipeline = null;
  }
}