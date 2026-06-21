import type { Task, TaskStatus, EnqueueTaskInput } from "@/shared/types/task.types";

/** 任务处理器 */
export type TaskHandler = (task: Task) => Promise<unknown>;

/** 任务队列接口 */
export interface ITaskQueue {
  enqueue(input: EnqueueTaskInput): Promise<string>;
  dequeue(): Promise<Task | null>;
  updateStatus(id: string, status: TaskStatus, result?: unknown, error?: string): Promise<void>;
  cancel(id: string): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  getTasksByGroup(groupId: string): Promise<Task[]>;
  resetRunningTasks(): Promise<void>;
}

/** 任务执行器接口 */
export interface ITaskExecutor {
  registerHandler(type: string, handler: TaskHandler): void;
  startWorkers(concurrency?: number): void;
  stopWorkers(): Promise<void>;
}