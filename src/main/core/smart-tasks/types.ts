/**
 * 智能任务执行器类型定义
 */
import type { SmartTaskRunStatus } from "@/shared/types";

export type {
  SmartTaskStep,
  SmartTaskStepKind,
  SmartTaskStepState,
  SmartTaskSnapshot,
  SmartTaskModelFamily,
  SmartTaskRunStatus,
} from "@/shared/types";

/** 任务执行上下文 */
export interface TaskContext {
  /** 执行 ID */
  executionId: string;
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
  /** 处理的实体数量（不含失败条目；失败条目不写阶段标记，下一轮重试） */
  processedCount: number;
  /**
   * 本轮失败的条目数。未报告的阶段（主题类任务）为 undefined，
   * 消费方按「未统计」处理，不要当成 0。
   */
  failedCount?: number;
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

/** 任务状态（与共享类型 SmartTaskRunStatus 同源） */
export type TaskStatus = SmartTaskRunStatus;

/** 调度器状态 */
export interface SchedulerState {
  status: TaskStatus;
  currentTask: string | null;
  totalTasks: number;
  completedTasks: number;
  progress: ProgressUpdate | null;
  executionId: string | null;
}