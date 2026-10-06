/**
 * 智能任务 DAG 定义
 * 定义 MVP 6 个任务的依赖关系
 */
import type { ModelFamily } from "@/main/core/model-gateway/local-gateway/model-registry";
import { TASK_TYPE, type TaskType } from "@/shared/enums";

/** 任务 DAG 节点 */
export interface TaskDagNode {
  name: string;
  dependencies: string[];
  description: string;
}

/** MVP 任务 DAG */
export const MVP_TASK_DAG: TaskDagNode[] = [
  // 第 0 层：摘要生成（向量化的前置，须先跑）
  { name: "chunk-summary", dependencies: [], description: "Block 摘要生成" },

  // 第 1 层：向量化要求 ai_summary 已生成，故必须排在 summary 之后（否则首轮选取 0 条）
  { name: "chunk-vectorize", dependencies: ["chunk-summary"], description: "Chunk 向量化" },

  // 第 2 层：依赖向量化完成（可并行）
  { name: "semantic-link", dependencies: ["chunk-vectorize"], description: "语义链接生成" },
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

/**
 * 任务 → 使用模型 family 的映射（与 DAG 定义集中维护）。
 * `null` 表示该任务不调用任何本地模型（仅读写 DAO）。
 */
export const TASK_MODEL_FAMILY: Record<string, ModelFamily | null> = {
  "chunk-summary": "llm",
  "chunk-vectorize": "embedding",
  "semantic-link": "reranker",
  "concept-extract": "llm",
  "topic-detection": null,
  "topic-summary": "llm",
};

/**
 * 智能任务 → LLM 路由任务类型（仅 llm family 的任务有值）。
 * 决定调度器是否为本地 LLM 预加载：只有路由判定为「local」的任务才需要本地 LLM。
 */
export const TASK_LLM_TASK_TYPE: Record<string, TaskType | null> = {
  "chunk-summary": TASK_TYPE.SUMMARY,
  "concept-extract": TASK_TYPE.CONCEPT_NAMING,
  "topic-summary": TASK_TYPE.TOPIC_SUMMARY,
};

/**
 * 依据路由决策计算本轮需要预加载的本地 LLM family 集合。
 * - 仅 LLM 类任务参与路由（embedding / reranker / 无模型任务始终按需本地加载）。
 * - 路由不可用（本地与云端都不可用）时视为不需要预加载，交由执行阶段报错。
 */
export async function resolveLocalFamilies(
  taskNames: string[],
  route: (task: TaskType) => Promise<"local" | "cloud">,
): Promise<Set<ModelFamily>> {
  const families = new Set<ModelFamily>();
  for (const name of taskNames) {
    const taskType = TASK_LLM_TASK_TYPE[name];
    if (!taskType) continue;
    try {
      if ((await route(taskType)) === "local") families.add("llm");
    } catch {
      // 路由不可用：不预加载本地 LLM
    }
  }
  return families;
}

/**
 * family 组的固定执行顺序：便宜的先跑，最贵的 LLM 最后跑完可立即释放。
 * 无模型的 family（null）由分组函数追加在最后。
 */
export const MODEL_FAMILY_EXECUTION_ORDER: ModelFamily[] = ["embedding", "reranker", "llm"];

/**
 * 给定一批尚未执行的任务名，判断是否仍需要某个 family 的模型。
 * 用于「用完即卸」判定：当剩余任务都不再使用该 family 时即可释放。
 */
export function isModelFamilyNeeded(family: ModelFamily, pendingTaskNames: string[]): boolean {
  return pendingTaskNames.some((name) => TASK_MODEL_FAMILY[name] === family);
}

/**
 * 将同层任务按 family 分组，返回按固定顺序（embedding → reranker → llm → 无模型）排列的组。
 */
export function groupTasksByModelFamily(
  taskNames: string[],
): Array<{ family: ModelFamily | null; tasks: string[] }> {
  const groups: Array<{ family: ModelFamily | null; tasks: string[] }> = [];
  for (const family of MODEL_FAMILY_EXECUTION_ORDER) {
    const tasks = taskNames.filter((name) => TASK_MODEL_FAMILY[name] === family);
    if (tasks.length > 0) groups.push({ family, tasks });
  }
  const noModelTasks = taskNames.filter((name) => (TASK_MODEL_FAMILY[name] ?? null) === null);
  if (noModelTasks.length > 0) groups.push({ family: null, tasks: noModelTasks });
  return groups;
}

/** 收集一层内出现的模型 family（去重，按 MODEL_FAMILY_EXECUTION_ORDER 排列） */
export function collectLayerFamilies(taskNames: string[]): ModelFamily[] {
  const present = new Set<ModelFamily>();
  for (const name of taskNames) {
    const family = TASK_MODEL_FAMILY[name];
    if (family) present.add(family);
  }
  return MODEL_FAMILY_EXECUTION_ORDER.filter((family) => present.has(family));
}

/**
 * 从本层涉及的 family 中选出可立即释放的 family：
 * 本层已全部结束，且剩余任务（后续层）都不再需要该 family。
 */
export function selectReleasableFamilies(
  layerFamilies: ModelFamily[],
  remainingTaskNames: string[],
): ModelFamily[] {
  return layerFamilies.filter(
    (family) => !isModelFamilyNeeded(family, remainingTaskNames),
  );
}

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