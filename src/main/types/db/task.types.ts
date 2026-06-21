import { Id, Timestamp } from "@/shared/types";

export type TaskStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export type TaskId = Id;

export interface TaskRow {
  id: TaskId;
  type: string;
  status: TaskStatus;
  payload: string; // JSON
  priority: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  result: string | null; // JSON
  group_id: string | null;
  depends_on: string | null;
}

export interface TaskCreate {
  id?: TaskId;
  type: string;
  status?: TaskStatus;
  payload?: string;
  priority?: number;
  started_at?: Timestamp | null;
  finished_at?: Timestamp | null;
  retry_count?: number;
  max_retries?: number;
  error_message?: string | null;
  result?: string | null;
  group_id?: string | null;
  depends_on?: string | null;
}

export interface TaskUpdate {
  status?: TaskStatus;
  payload?: string;
  priority?: number;
  started_at?: Timestamp | null;
  finished_at?: Timestamp | null;
  retry_count?: number;
  error_message?: string | null;
  result?: string | null;
}

export interface TaskQuery {
  id?: TaskId;
  type?: string;
  status?: TaskStatus;
  group_id?: string | null;
  depends_on?: string | null;
}