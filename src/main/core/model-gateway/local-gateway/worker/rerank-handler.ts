/**
 * Worker 重排序模型推理 handler
 */
import type { TextClassificationPipeline, TextClassificationSingle } from "@xenova/transformers";
import type { TransformersModelPaths } from "../types";

let rerankPipeline: TextClassificationPipeline | null = null;
let rerankModelName = "Xenova/bge-reranker-v2-m3";

export async function load(config?: {
  modelName?: string;
  transformers?: TransformersModelPaths;
}): Promise<{ modelName: string }> {
  if (config?.modelName) rerankModelName = config.modelName;
  const { pipeline, env } = await import("@xenova/transformers");

  const paths = config?.transformers;
  if (paths) {
    // 强制从本地下载目录读取：关闭远程回退并指定本地模型根目录
    env.allowRemoteModels = false;
    env.localModelPath = paths.modelRoot;
  }

  rerankPipeline = await pipeline(
    "text-classification",
    paths?.modelDir ?? rerankModelName,
    paths ? { quantized: false, model_file_name: paths.modelFileName } : undefined,
  ) as TextClassificationPipeline;

  return { modelName: paths?.modelDir ?? rerankModelName };
}

export async function rerank(
  query: string,
  documents: string[],
): Promise<{ index: number; score: number }[]> {
  if (!rerankPipeline) throw new Error("重排序模型未加载");
  if (documents.length === 0) return [];

  const pairs = documents.map((doc) => `${query} [SEP] ${doc}`);
  // 一次数组推理；单标签模型批量输入返回 [batch, labels]（兼容 [batch] 形态）
  const raw = (await rerankPipeline(pairs)) as
    | TextClassificationSingle[]
    | TextClassificationSingle[][];

  const scores: { index: number; score: number }[] = documents.map((_, i) => {
    const entry = raw[i] as
      | TextClassificationSingle
      | TextClassificationSingle[]
      | undefined;
    const score = Array.isArray(entry)
      ? (entry[0]?.score ?? 0)
      : (entry?.score ?? 0);
    return { index: i, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

export async function unload(): Promise<void> {
  if (rerankPipeline) {
    await rerankPipeline.dispose?.();
    rerankPipeline = null;
  }
}