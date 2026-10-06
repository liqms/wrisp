/**
 * 智能整理任务进度类型定义（主进程 → 渲染进程）
 */

/** 智能整理运行状态 */
export type SmartTaskRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/** 本地模型 family */
export type SmartTaskModelFamily = "embedding" | "reranker" | "llm";

/** 步骤类型 */
export type SmartTaskStepKind = "prepare" | "model-load" | "task" | "model-release" | "done";

/** 步骤状态 */
export type SmartTaskStepState = "pending" | "running" | "success" | "failed" | "skipped";

/** 单个执行步骤 */
export interface SmartTaskStep {
  /** 唯一 id：prepare / done / task:<name> / model-load:<family>#<n> */
  id: string;
  /** 步骤类型 */
  kind: SmartTaskStepKind;
  /** 任务名 | family | 固定标识，渲染层据此映射 i18n 文案 */
  ref: string;
  /** 当前状态 */
  state: SmartTaskStepState;
  /** 任务节点：需处理的数据量（总条数） */
  dataAmount?: number;
  /** 任务节点：已处理条数 */
  processedCount?: number;
  /** 模型节点：family */
  family?: SmartTaskModelFamily;
  /** 模型节点：模型 id */
  modelId?: string;
  /** 模型节点：执行后 CPU 使用率 0-100 */
  cpuUsage?: number;
  /** 模型节点：执行后已用内存（bytes） */
  memoryUsed?: number;
  /** 模型节点：内存总量（bytes） */
  memoryTotal?: number;
  /** 模型节点：内存占用百分比 0-100 */
  memoryPercent?: number;
  /** 失败 / 跳过原因 */
  reason?: string;
  /** 开始时间戳 */
  startedAt?: number;
  /** 结束时间戳 */
  finishedAt?: number;
}

/** 智能整理进度快照 */
export interface SmartTaskSnapshot {
  /** 执行 ID */
  executionId: string | null;
  /** 运行状态 */
  status: SmartTaskRunStatus;
  /** 整体百分比 */
  overallPercent: number;
  /** 步骤明细 */
  steps: SmartTaskStep[];
}