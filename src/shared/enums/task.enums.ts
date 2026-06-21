/**
 * 任务类型枚举
 * 用于模型路由层根据任务类型选择本地/云端 AI 源
 */
export const TASK_TYPE = {
  /** 向量嵌入 */
  EMBEDDING: "embedding",
  /** 重排序 */
  RERANK: "rerank",
  /** 语义聚类 */
  CLUSTERING: "clustering",
  /** 主题检测 */
  TOPIC_DETECTION: "topic_detection",
  /** 短摘要 */
  SHORT_SUMMARY: "short_summary",
  /** 简单反思 */
  SIMPLE_REFLECTION: "simple_reflection",
  /** 重写 */
  REWRITE: "rewrite",
  /** 润色 */
  POLISH: "polish",
  /** 推理 */
  REASONING: "reasoning",
  /** 长文生成 */
  LONG_WRITING: "long_writing",
  /** 多模态 */
  MULTIMODAL: "multimodal",
} as const;

export type TaskType = (typeof TASK_TYPE)[keyof typeof TASK_TYPE];