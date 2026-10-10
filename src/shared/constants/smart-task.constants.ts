import type { SmartTaskConfig } from "@/shared/types";

/**
 * 智能整理的默认参数。
 * 本地推理为 CPU 形态时，语义链接是 CPU 占用最高的阶段，故默认值偏保守：
 * 宁可单轮跑得慢，也不让 reranker 与 LLM 同时吃满核心。
 */
export const DEFAULT_SMART_TASK_CONFIG: SmartTaskConfig = {
  semanticLinkConcurrency: 1,
  annTopK: 8,
  rerankTopK: 4,
  onnxIntraOpThreads: null,
  llmMaxThreads: null,
  conceptInputWindowChars: 1200,
  conceptMergeAutoThreshold: 0.88,
  conceptMergeReviewThreshold: 0.75,
  topicClusterThreshold: 0.72,
  evidenceBatchSize: 12,
  shardSize: 8,
  allowCpuBoundParallel: false,
};
