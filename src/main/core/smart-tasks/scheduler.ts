import { TaskExecutor, TaskContext, TaskResult, TaskStatus } from "./types";
import { progressManager } from "./progress.manager";
import { MVP_TASK_DAG, TASK_EXECUTION_ORDER } from "./task-dag";
import { TaskExecutionDao } from "@/main/core/db/task-execution.dao";
import { ChunkDao } from "@/main/core/db";
import { TaskExecutionCreate, TaskExecutionUpdate, Chunk } from "@/main/types/db";
import { ChunkVectorizeExecutor } from "./executors/chunk-vectorize.executor";
import { ChunkSummaryExecutor } from "./executors/chunk-summary.executor";
import { SemanticLinkExecutor } from "./executors/semantic-link.executor";
import { ConceptExtractExecutor } from "./executors/concept-extract.executor";
import { TopicDetectionExecutor } from "./executors/topic-detection.executor";
import { TopicSummaryExecutor } from "./executors/topic-summary.executor";
import { Logger } from "@/main/utils/logger";
import { generateId } from "@/shared/utils";
import { TimeUtil } from "@/shared/utils/time";

class SmartTaskScheduler {
  private static instance: SmartTaskScheduler | null = null;

  private taskExecutionDao = new TaskExecutionDao();
  private chunkDao = new ChunkDao();
  private status: TaskStatus = "idle";
  private currentExecutionId: string | null = null;
  private cancelSignal = { cancelled: false };
  private pauseSignal = { paused: false };

  // 注册所有执行器
  private executors: Map<string, TaskExecutor> = new Map();
  private taskOrder = TASK_EXECUTION_ORDER;

  private constructor() {
    this.registerExecutor(new ChunkSummaryExecutor());
    this.registerExecutor(new ChunkVectorizeExecutor());
    this.registerExecutor(new SemanticLinkExecutor());
    this.registerExecutor(new ConceptExtractExecutor());
    this.registerExecutor(new TopicDetectionExecutor());
    this.registerExecutor(new TopicSummaryExecutor());
  }

  public static getInstance(): SmartTaskScheduler {
    if (!SmartTaskScheduler.instance) {
      SmartTaskScheduler.instance = new SmartTaskScheduler();
    }
    return SmartTaskScheduler.instance;
  }

  /** 注册执行器 */
  private registerExecutor(executor: TaskExecutor): void {
    this.executors.set(executor.name, executor);
  }

  /** 获取调度器状态 */
  public getStatus(): { status: TaskStatus; executionId: string | null; progress: unknown } {
    return {
      status: this.status,
      executionId: this.currentExecutionId,
      progress: progressManager.getProgress(),
    };
  }

  /** 开始执行 */
  public async start(): Promise<{ executionId: string }> {
    if (this.status === "running") {
      throw new Error("已有智能任务正在运行");
    }

    this.cancelSignal.cancelled = false;
    this.pauseSignal.paused = false;
    this.status = "running";

    try {
      // 计算增量范围
      const latestLog = this.taskExecutionDao.findLatestSucceeded();
      const processedUntil = latestLog?.processed_until || null;

      // 创建执行记录
      const executionId = generateId();
      this.currentExecutionId = executionId;
      const create: TaskExecutionCreate = {
        id: executionId,
        started_at: TimeUtil.getLocalDateString(),
        status: "running",
        tasks_summary: JSON.stringify(this.taskOrder.map((n) => ({ name: n, status: "pending" }))),
        processed_until: null,
      };
      this.taskExecutionDao.create(create);

      // 注册进度
      progressManager.registerTasks(this.taskOrder);

      // 按拓扑顺序执行
      const context: TaskContext = {
        executionId,
        processedUntil,
        cancelSignal: this.cancelSignal,
        pauseSignal: this.pauseSignal,
      };

      const results: TaskResult[] = [];
      const completedTasks = new Set<string>();

      for (const taskName of this.taskOrder) {
        if (this.cancelSignal.cancelled) break;

        const executor = this.executors.get(taskName);
        if (!executor) {
          Logger.error("[SmartTaskScheduler] 未知任务", { taskName });
          continue;
        }

        // 检查依赖
        if (executor.dependencies && executor.dependencies.length > 0) {
          const depsSatisfied = executor.dependencies.every((d) => completedTasks.has(d));
          if (!depsSatisfied) {
            Logger.warn("[SmartTaskScheduler] 依赖未满足，跳过任务", { taskName, dependencies: executor.dependencies });
            continue;
          }
        }

        // 等待暂停恢复
        while (this.pauseSignal.paused && !this.cancelSignal.cancelled) {
          await this.sleep(500);
        }
        if (this.cancelSignal.cancelled) break;

        Logger.info("[SmartTaskScheduler] 开始执行任务", { taskName });
        const result = await executor.run(context);
        results.push(result);
        progressManager.completeTask(result);
        completedTasks.add(taskName);

        if (result.success) {
          Logger.info("[SmartTaskScheduler] 任务完成", { taskName, processed: result.processedCount });
        } else {
          Logger.error("[SmartTaskScheduler] 任务失败", { taskName, error: result.error });
          // 任务失败但继续执行后续任务（非阻塞）
        }
      }

      // 计算最大 updated_at
      const maxUpdatedAt = this.computeProcessedUntil();
      const finalStatus = this.cancelSignal.cancelled ? "cancelled" : "succeeded";

      // 更新执行记录
      const update: TaskExecutionUpdate = {
        finished_at: TimeUtil.getLocalDateString(),
        status: finalStatus,
        tasks_summary: JSON.stringify(
          results.map((r) => ({
            name: r.taskName,
            success: r.success,
            processedCount: r.processedCount,
            error: r.error,
          })),
        ),
        processed_until: maxUpdatedAt,
      };
      this.taskExecutionDao.update(executionId, update);

      this.status = finalStatus === "succeeded" ? "completed" : finalStatus;
      return { executionId };
    } catch (error) {
      Logger.error("[SmartTaskScheduler] 执行异常", { error: String(error) });
      this.status = "failed";

      if (this.currentExecutionId) {
        const update: TaskExecutionUpdate = {
          finished_at: new Date().toISOString(),
          status: "failed",
          tasks_summary: JSON.stringify({ error: String(error) }),
        };
        this.taskExecutionDao.update(this.currentExecutionId, update);
      }

      throw error;
    }
  }

  /** 取消 */
  public cancel(): void {
    this.cancelSignal.cancelled = true;
    Logger.info("[SmartTaskScheduler] 收到取消请求");
  }

  /** 暂停 */
  public pause(): void {
    this.pauseSignal.paused = true;
    this.status = "paused";
    Logger.info("[SmartTaskScheduler] 任务已暂停");
  }

  /** 恢复 */
  public resume(): void {
    this.pauseSignal.paused = false;
    this.status = "running";
    Logger.info("[SmartTaskScheduler] 任务已恢复");
  }

  /** 获取所有执行记录 */
  public getExecutionHistory(): ReturnType<TaskExecutionDao["findAll"]> {
    return this.taskExecutionDao.findAll();
  }

  /** 计算本次处理的 updated_at 最大值 */
  private computeProcessedUntil(): string | null {
    const blocks = this.chunkDao.findAll() as Chunk[];
    if (blocks.length === 0) return null;
    const max = blocks.reduce((max, b) => (b.updated_at > max ? b.updated_at : max), blocks[0].updated_at);
    return max;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default SmartTaskScheduler;
export const smartTaskScheduler = SmartTaskScheduler.getInstance();