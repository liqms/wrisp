/**
 * LLM 调用并发控制器
 * 通过信号量限制同时进行的 LLM 请求数，避免资源争抢
 */

export interface AcquireOptions {
  /** 优先级：high=用户交互（技能），low=后台任务（Smart Tasks） */
  priority?: "high" | "low";
}

interface QueueItem {
  priority: "high" | "low";
  resolve: () => void;
}

export class LLMConcurrencyController {
  private active = 0;
  private readonly queue: QueueItem[] = [];

  constructor(private readonly maxConcurrent: number = 5) {}

  /** 获取信号量并执行任务，执行完毕自动释放 */
  async acquire<T>(
    task: () => Promise<T>,
    options?: AcquireOptions,
  ): Promise<T> {
    await this.acquireSlot(options?.priority ?? "high");
    try {
      return await task();
    } finally {
      this.releaseSlot();
    }
  }

  /** 手动获取信号量（用于流式场景），返回释放函数 */
  async acquireSlotManual(priority: "high" | "low" = "high"): Promise<() => void> {
    await this.acquireSlot(priority);
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.releaseSlot();
      }
    };
  }

  /** 获取当前活跃请求数 */
  getActiveCount(): number {
    return this.active;
  }

  /** 等待队列中的请求数 */
  getQueueLength(): number {
    return this.queue.length;
  }

  private acquireSlot(priority: "high" | "low"): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ priority, resolve: () => { this.active++; resolve(); } });
    });
  }

  private releaseSlot(): void {
    this.active--;
    if (this.queue.length > 0 && this.active < this.maxConcurrent) {
      // 高优先级优先出队
      const highIdx = this.queue.findIndex((item) => item.priority === "high");
      const idx = highIdx >= 0 ? highIdx : 0;
      const next = this.queue.splice(idx, 1)[0];
      next.resolve();
    }
  }
}
