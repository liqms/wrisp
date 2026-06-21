import { TaskQueue } from "./task-queue";
import type { TaskHandler } from "./types";
import { Logger } from "@/main/utils/logger";

const IDLE_TIMEOUT_MS = 5000;

export class TaskExecutor {
  private queue: TaskQueue;
  private handlers: Map<string, TaskHandler> = new Map();
  private running = false;
  private activeWorkers = 0;
  private stopResolve: (() => void) | null = null;
  private notifyResolve: (() => void) | null = null;

  constructor(queue: TaskQueue) {
    this.queue = queue;
  }

  /** 注册任务处理器 */
  registerHandler(type: string, handler: TaskHandler): void {
    this.handlers.set(type, handler);
    Logger.info("[TaskExecutor] 注册处理器", { type });
  }

  /** 启动工作器 */
  startWorkers(concurrency = 1): void {
    if (this.running) return;
    this.running = true;
    Logger.info("[TaskExecutor] 启动工作器", { concurrency });

    for (let i = 0; i < concurrency; i++) {
      this.runWorker(i);
    }
  }

  /** 停止工作器 */
  async stopWorkers(): Promise<void> {
    this.running = false;
    Logger.info("[TaskExecutor] 停止信号已发送");

    // 唤醒所有等待的工作器，让它们退出循环
    this.resolveNotify();

    if (this.activeWorkers > 0) {
      return new Promise<void>((resolve) => {
        this.stopResolve = resolve;
      });
    }
  }

  /** 唤醒所有空闲工作器 */
  notify(): void {
    this.resolveNotify();
  }

  /** 工作器主循环 */
  private async runWorker(workerId: number): Promise<void> {
    this.activeWorkers++;
    Logger.info("[TaskExecutor] 工作器启动", { workerId });

    while (this.running) {
      try {
        const task = await this.queue.dequeue();
        if (!task) {
          // 队列为空，等待信号唤醒（最长 IDLE_TIMEOUT_MS 兜底）
          await this.waitForSignal();
          continue;
        }

        const handler = this.handlers.get(task.type);
        if (!handler) {
          Logger.warn("[TaskExecutor] 无处理器", { type: task.type });
          await this.queue.updateStatus(task.id, "failed", undefined, `No handler for type: ${task.type}`);
          continue;
        }

        try {
          const result = await handler(task);
          await this.queue.updateStatus(task.id, "succeeded", result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          Logger.error("[TaskExecutor] 任务执行失败", { id: task.id, error: errorMessage });

          if (task.retryCount < task.maxRetries) {
            // 重试：重置为 pending，增加 retry_count
            const newRetryCount = task.retryCount + 1;
            const { TaskDao } = await import("@/main/core/db/task.dao");
            const dao = new TaskDao();
            dao.update(task.id, {
              status: "pending",
              retry_count: newRetryCount,
              error_message: errorMessage,
              started_at: null,
            });
            Logger.info("[TaskExecutor] 任务重试", { id: task.id, retry: newRetryCount });
          } else {
            await this.queue.updateStatus(task.id, "failed", undefined, errorMessage);
          }
        }
      } catch (error) {
        Logger.error("[TaskExecutor] 工作器错误", { workerId, error: String(error) });
        await this.waitForSignal();
      }
    }

    this.activeWorkers--;
    Logger.info("[TaskExecutor] 工作器停止", { workerId });

    if (this.activeWorkers === 0 && this.stopResolve) {
      this.stopResolve();
      this.stopResolve = null;
    }
  }

  /** 等待信号唤醒，IDLE_TIMEOUT_MS 超时后自动返回（兜底） */
  private waitForSignal(): Promise<void> {
    if (!this.notifyResolve) {
      this.notifyPromise = new Promise((resolve) => {
        this.notifyResolve = resolve;
      });
    }
    return Promise.race([
      this.notifyPromise!,
      this.sleep(IDLE_TIMEOUT_MS),
    ]);
  }

  private resolveNotify(): void {
    if (this.notifyResolve) {
      this.notifyResolve();
      this.notifyResolve = null;
      this.notifyPromise = null;
    }
  }

  private notifyPromise: Promise<void> | null = null;

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}