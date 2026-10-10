/**
 * Worker 重排序模型推理 handler
 */
import type { TextClassificationPipeline } from "@huggingface/transformers";
import type { TransformersModelPaths } from "../types";
import { Logger } from "@/main/utils/logger";

/** 单条分类结果（v4 未从包根导出该类型，按结构声明所需字段） */
type ClassificationResult = { label: string; score: number };

let rerankPipeline: TextClassificationPipeline | null = null;
let rerankModelName = "Xenova/bge-reranker-v2-m3";

export async function load(config?: {
  modelName?: string;
  transformers?: TransformersModelPaths;
  intraOpNumThreads?: number;
}): Promise<{ modelName: string }> {
  if (config?.modelName) rerankModelName = config.modelName;
  const { pipeline, env } = await import("@huggingface/transformers");

  const paths = config?.transformers;
  if (paths) {
    // 强制从本地下载目录读取：关闭远程回退并指定本地模型根目录
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = paths.modelRoot;
  }

  const intraOpNumThreads = config?.intraOpNumThreads;
  rerankPipeline = await pipeline(
    "text-classification",
    paths?.modelDir ?? rerankModelName,
    // 只给 dtype：库按 `onnx/model<后缀>.onnx` 拼文件名，再给 model_file_name 会拼成双后缀
    paths
      ? {
          dtype: paths.dtype,
          // 交叉编码器是本阶段最热的算子，不限线程时会按全部逻辑核建线程池
          ...(intraOpNumThreads
            ? { session_options: { intraOpNumThreads } }
            : {}),
        }
      : undefined,
  ) as TextClassificationPipeline;

  Logger.info("[RerankHandler] 重排序模型已加载", { intraOpNumThreads: intraOpNumThreads ?? "default" });
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
    | ClassificationResult[]
    | ClassificationResult[][];

  const scores: { index: number; score: number }[] = documents.map((_, i) => {
    const entry = raw[i] as ClassificationResult | ClassificationResult[] | undefined;
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