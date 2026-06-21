/** 任务状态 */
export type TaskStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

/** 任务实体（与 SQLite 行对应） */
export interface Task {
  id: string;
  type: string;
  status: TaskStatus;
  payload: string; // JSON string
  priority: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  result: string | null; // JSON string
  groupId: string | null;
  dependsOn: string | null;
}

/** 入队参数 */
export interface EnqueueTaskInput {
  type: string;
  payload: unknown;
  priority?: number;
  maxRetries?: number;
  groupId?: string;
  dependsOn?: string;
}