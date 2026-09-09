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

/** 获取指定任务的依赖列表 */
export function getTaskDependencies(taskName: string): string[] {
  const node = MVP_TASK_DAG.find((n) => n.name === taskName);
  return node?.dependencies ?? [];
}

/** 按 DAG 依赖关系将任务分层（同层任务无相互依赖，可并行执行） */
export function getTaskLayers(): string[][] {
  const layers: string[][] = [];
  const assigned = new Set<string>();

  // 第 0 层：所有无依赖任务（根节点）并行
  const rootLayer = MVP_TASK_DAG
    .filter((n) => n.dependencies.length === 0)
    .map((n) => n.name);
  if (rootLayer.length === 0) return layers;
  for (const name of rootLayer) {
    assigned.add(name);
  }
  layers.push(rootLayer);

  // 后续层：每轮收集所有依赖已满足的任务，同层可并行
  while (assigned.size < MVP_TASK_DAG.length) {
    const currentLayer: string[] = [];
    for (const node of MVP_TASK_DAG) {
      if (assigned.has(node.name)) continue;
      const depsReady = node.dependencies.every((d) => assigned.has(d));
      if (depsReady) {
        currentLayer.push(node.name);
      }
    }
    if (currentLayer.length === 0) break; // 防止循环依赖死循环
    for (const name of currentLayer) {
      assigned.add(name);
    }
    layers.push(currentLayer);
  }

  return layers;
}