/**
 * 本地 AI 核心类型定义
 */

/** 模型状态 */
export type ModelStatus = "unloaded" | "loading" | "loaded" | "error";

/** 池化方法 */
export type PoolingMethod = "mean" | "cls";

/** 嵌入模型配置 */
export interface EmbeddingConfig {
  /** 模型名称，默认 bge-small-en-v1.5 */
  modelName?: string;
  /** 池化方法，默认 mean */
  pooling?: PoolingMethod;
  /** 是否归一化向量，默认 true */
  normalize?: boolean;
}

/** 重排序模型配置 */
export interface RerankConfig {
  /** 模型名称，默认 ms-marco-MiniLM-L-6-v2 */
  modelName?: string;
}

/** 重排序结果 */
export interface RerankResult {
  /** 文档原始索引 */
  index: number;
  /** 相关性分数（0~1） */
  score: number;
}

/** 嵌入结果 */
export interface EmbeddingResult {
  /** 嵌入向量 */
  vector: number[];
  /** 向量维度 */
  dimension: number;
}

/** 模型状态信息 */
export interface ModelState {
  status: ModelStatus;
  modelName: string;
  error?: string;
}

/** 本地 AI 总配置 */
export interface LocalAiConfig {
  embedding?: EmbeddingConfig;
  rerank?: RerankConfig;

  /** 模型缓存目录，默认使用 Transformers.js 默认缓存 */
  cacheDir?: string;
}

/** 默认嵌入模型配置 */
export const DEFAULT_EMBEDDING_CONFIG: Required<EmbeddingConfig> = {
  modelName: "Xenova/jina-embeddings-v3",
  pooling: "mean",
  normalize: true,
};

/** 默认重排序模型配置 */
export const DEFAULT_RERANK_CONFIG: Required<RerankConfig> = {
  modelName: "Xenova/bge-reranker-v2-m3",
};
