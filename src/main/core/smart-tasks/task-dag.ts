/**
 * 智能任务 DAG 定义
 * 定义 MVP 6 个任务的依赖关系
 */

/** 任务 DAG 节点 */
export interface TaskDagNode {
  name: string;
  dependencies: string[];
  description: string;
}

/** MVP 任务 DAG */
export const MVP_TASK_DAG: TaskDagNode[] = [
  // 第 0 层：无依赖，可并行
  { name: "chunk-summary", dependencies: [], description: "Block 摘要生成" },
  { name: "chunk-vectorize", dependencies: [], description: "Chunk 向量化" },

  // 第 1 层：依赖向量化完成
  { name: "semantic-link", dependencies: ["chunk-vectorize"], description: "语义链接生成" },

  // 第 2 层：依赖摘要 + 向量化完成
  { name: "concept-extract", dependencies: ["chunk-summary", "chunk-vectorize"], description: "概念提取" },

  // 第 3 层：依赖概念提取完成
  { name: "topic-detection", dependencies: ["concept-extract"], description: "主题检测与聚类" },

  // 第 4 层：依赖主题检测完成
  { name: "topic-summary", dependencies: ["topic-detection"], description: "主题摘要生成" },
];

/** 按拓扑排序后的任务名称列表 */
export const TASK_EXECUTION_ORDER: string[] = [
  "chunk-summary",
  "chunk-vectorize",
  "semantic-link",
  "concept-extract",
  "topic-detection",
  "topic-summary",
];