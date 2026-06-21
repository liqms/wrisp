import type { ApiResponse } from "@/shared/types";
import type { Task, EnqueueTaskInput } from "@/shared/types/task.types";

export interface TaskAPI {
  enqueue(input: EnqueueTaskInput): Promise<ApiResponse<string>>;
  getTask(taskId: string): Promise<ApiResponse<Task | null>>;
  getTasksByGroup(groupId: string): Promise<ApiResponse<Task[]>>;
  cancel(taskId: string): Promise<ApiResponse<void>>;
  getProgress(groupId: string): Promise<ApiResponse<{
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    running: number;
  }>>;
}