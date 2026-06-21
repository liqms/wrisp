import { TaskQueue } from "./task-queue";
import { TaskExecutor } from "./task-executor";

/** 全局任务队列单例 */
export const taskQueue = new TaskQueue();

/** 全局任务执行器单例 */
export const taskExecutor = new TaskExecutor(taskQueue);

// 任务入队时自动唤醒执行器，避免轮询
taskQueue.onEnqueue(() => taskExecutor.notify());