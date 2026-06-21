/**
 * 智能任务执行器类型定义
 */
import { Id, Timestamp } from "@/shared/types";

/** 任务执行上下文 */
export interface TaskContext {
  /** 执行 ID */
  executionId: string;
  /** 增量范围：仅处理 updated_at > 此值的实体 */
  processedUntil: Timestamp | null;
  /** 取消信号 */
  cancelSignal: { cancelled: boolean };
  /** 暂停信号 */
  pauseSignal: { paused: boolean };
}

/** 任务执行结果 */
export interface TaskResult {
  /** 任务名称 */
  taskName: string;
  /** 是否成功 */
  success: boolean;
  /** 处理的实体数量 */
  processedCount: number;
  /** 错误信息（失败时） */
  error?: string;
  /** 额外的执行摘要 */
  summary?: Record<string, unknown>;
}

/** 任务执行器接口 */
export interface TaskExecutor {
  /** 任务名称 */
  name: string;
  /** 依赖的其他任务名（为空表示无依赖） */
  dependencies?: string[];
  /** 执行任务 */
  run(context: TaskContext): Promise<TaskResult>;
}

/** 进度更新 */
export interface ProgressUpdate {
  /** 任务名称 */
  taskName: string;
  /** 当前进度 */
  current: number;
  /** 总数 */
  total: number;
  /** 整体百分比 */
  overallPercent: number;
}

/** 任务状态 */
export type TaskStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";

/** 调度器状态 */
export interface SchedulerState {
  status: TaskStatus;
  currentTask: string | null;
  totalTasks: number;
  completedTasks: number;
  progress: ProgressUpdate | null;
  executionId: string | null;
}