import { Id, Timestamp } from "@/shared/types";

export type TaskExecutionStatus = "running" | "paused" | "succeeded" | "failed" | "cancelled";

export type TaskExecutionId = Id;

export interface TaskExecutionLog {
  id: TaskExecutionId;
  started_at: Timestamp;
  finished_at: Timestamp | null;
  status: TaskExecutionStatus;
  tasks_summary: string; // JSON 记录每个任务的执行情况
  processed_until: Timestamp | null; // 增量标记的最大 updated_at
}

export interface TaskExecutionCreate {
  id?: TaskExecutionId;
  started_at: Timestamp;
  finished_at?: Timestamp | null;
  status: TaskExecutionStatus;
  tasks_summary: string;
  processed_until?: Timestamp | null;
}

export interface TaskExecutionUpdate {
  finished_at?: Timestamp | null;
  status?: TaskExecutionStatus;
  tasks_summary?: string;
  processed_until?: Timestamp | null;
}

export interface TaskExecutionQuery {
  id?: TaskExecutionId;
  status?: TaskExecutionStatus;
}