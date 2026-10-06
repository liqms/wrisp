/**
 * 智能任务通用并发工具
 */

/** 取消信号（与 TaskContext.cancelSignal 同构） */
export interface CancelSignal {
  cancelled: boolean;
}

/**
 * 有界并发执行。
 * - 结果按输入顺序返回；被取消而未执行的位置为 undefined（调用方不应依赖其完整性）。
 * - 单项失败不中断整体：由 fn 内部自行 try/catch。
 * - 每项启动前检查取消信号：已取消则不再启动新项，在途项自然完成。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  cancelSignal?: CancelSignal,
): Promise<R[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (cancelSignal?.cancelled) return;
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  const runnerCount = Math.min(safeLimit, items.length);
  await Promise.all(Array.from({ length: runnerCount }, () => worker()));
  return results;
}