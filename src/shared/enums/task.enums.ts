/**
 * 任务类型枚举
 * 用于模型路由层根据任务类型选择本地/云端 AI 源
 */
export const TASK_TYPE = {
  /** 概念命名和演化摘要 */
  CONCEPT_NAMING: "concept_naming",
  /** 主题命名与摘要 */
  TOPIC_SUMMARY: "topic_summary",
  /** 摘要 */
  SUMMARY: "summary",
  /** 反思 */
  REFLECTION: "reflection",
  /** 改写 */
  REWRITE: "rewrite",
  /** 润色 */
  POLISH: "polish",
  /** 续写 */
  CONTINUE: "continue",
  /** 扩写 */
  EXPAND: "expand",
  /** 多模态 */
  MULTIMODAL: "multimodal",
} as const;

export type TaskType = (typeof TASK_TYPE)[keyof typeof TASK_TYPE];