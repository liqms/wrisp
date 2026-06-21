/**
 * Worker 重排序模型推理 handler
 */
import type { TextClassificationPipeline, TextClassificationSingle } from "@xenova/transformers";

let rerankPipeline: TextClassificationPipeline | null = null;
let rerankModelName = "Xenova/bge-reranker-v2-m3";

export async function load(config?: { modelName?: string }): Promise<void> {
  if (config?.modelName) rerankModelName = config.modelName;
  const { pipeline } = await import("@xenova/transformers");
  rerankPipeline = await pipeline("text-classification", rerankModelName) as TextClassificationPipeline;
}

export async function rerank(
  query: string,
  documents: string[],
): Promise<{ index: number; score: number }[]> {
  if (!rerankPipeline) throw new Error("重排序模型未加载");
  const scores: { index: number; score: number }[] = [];
  for (let i = 0; i < documents.length; i++) {
    const result = await rerankPipeline(`${query} [SEP] ${documents[i]}`) as TextClassificationSingle[];
    const score = result[0]?.score ?? 0;
    scores.push({ index: i, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

export async function unload(): Promise<void> {
  if (rerankPipeline) {
    await rerankPipeline.dispose?.();
    rerankPipeline = null;
  }
}