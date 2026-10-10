import { TaskExecutor, TaskContext, TaskResult, TaskStatus, SmartTaskSnapshot } from "./types";
import { progressManager } from "./progress.manager";
import { stepManager, taskStepId, STEP_DONE_ID } from "./step.manager";
import { getResourceSnapshot } from "./resource-snapshot";
import { parseEstimatedAmounts } from "./estimate";
import {
  getTaskLayers,
  groupTasksByModelFamily,
  collectLayerFamilies,
  selectReleasableFamilies,
  resolveLocalFamilies,
  countCpuBoundFamilies,
} from "./task-dag";
import {
  localAiManager,
  modelManager,
  getFamilyModelId,
  canLoadModelFamilies,
} from "@/main/core/model-gateway/local-gateway";
import type { ModelFamily } from "@/main/core/model-gateway/local-gateway";
import { TaskExecutionDao } from "@/main/core/db/task-execution.dao";
import { ChunkDao } from "@/main/core/db";
import { TaskExecutionCreate, TaskExecutionUpdate } from "@/main/types/db";
import { ChunkVectorizeExecutor } from "./executors/chunk-vectorize.executor";
import { ChunkSummaryExecutor } from "./executors/chunk-summary.executor";
import { PageVectorizeExecutor } from "./executors/page-vectorize.executor";
import { PageSummaryExecutor } from "./executors/page-summary.executor";
import { SemanticLinkExecutor } from "./executors/semantic-link.executor";
import { ConceptExtractExecutor } from "./executors/concept-extract.executor";
import { TopicDetectionExecutor } from "./executors/topic-detection.executor";
import { TopicSummaryExecutor } from "./executors/topic-summary.executor";
import { notifyWikiUpdated } from "@/main/core/services/content/wiki-events";
import { getSmartTaskConfig } from "./smart-task.config";
import { Logger } from "@/main/utils/logger";
import { modelRouter } from "@/main/core/model-gateway/router";
import { generateId } from "@/shared/utils";
import { TimeUtil } from "@/shared/utils/time";

/** 释放模型的结果 */
type ReleaseOutcome =
  | "released"
  | "skipped-busy"
  | "skipped-keepalive"
  | "no-model"
  | "failed";

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

  private constructor() {
    this.registerExecutor(new ChunkSummaryExecutor());
    this.registerExecutor(new ChunkVectorizeExecutor());
    this.registerExecutor(new PageSummaryExecutor());
    this.registerExecutor(new PageVectorizeExecutor());
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
  public getStatus(): {
    status: TaskStatus;
    executionId: string | null;
    progress: unknown;
    snapshot: SmartTaskSnapshot;
  } {
    return {
      status: this.status,
      executionId: this.currentExecutionId,
      progress: progressManager.getProgress(),
      snapshot: stepManager.getSnapshot(),
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
    let stepsStarted = false;

    try {
      // 创建执行记录
      const executionId = generateId();
      this.currentExecutionId = executionId;
      const layers = getTaskLayers();
      const flatTasks = layers.flat();
      const create: TaskExecutionCreate = {
        id: executionId,
        started_at: TimeUtil.getLocalDateString(),
        status: "running",
        tasks_summary: JSON.stringify(flatTasks.map((n) => ({ name: n, status: "pending" }))),
        processed_until: null,
      };
      this.taskExecutionDao.create(create);

      // 注册进度（layers.flat() 保持 DAG 拓扑序作为初始顺序）
      progressManager.registerTasks(flatTasks);
      // 注册步骤明细（准备 / 任务 / 结束 节点，模型节点在执行时动态插入）
      // 任务节点顺序需与实际执行顺序一致：同层内按 family 分组串行执行，故按分组后顺序展开
      const orderedTasks = layers.flatMap((layer) =>
        groupTasksByModelFamily(layer).flatMap((group) => group.tasks),
      );
      stepManager.beginExecution(executionId, orderedTasks, this.readEstimatedAmounts());
      stepsStarted = true;

      // 按 DAG 层级分组并行执行
      // 增量范围不再由调度器下发：各任务按自己的阶段标记列选取（§3.7）
      const context: TaskContext = {
        executionId,
        cancelSignal: this.cancelSignal,
        pauseSignal: this.pauseSignal,
      };

      const results: TaskResult[] = [];

      // 尚未执行的任务集合：用于判定某个 family 是否仍被后续任务需要（用完即卸）
      const remainingTasks = new Set<string>(flatTasks);
      // 本次用过的 family：整轮结束（成功/失败/取消）时兜底释放
      const usedFamilies = new Set<ModelFamily>();
      // 已在执行循环中产生释放节点的 family：兜底时不再重复释放
      const handledFamilies = new Set<ModelFamily>();

      // 本轮真正需要本地 LLM 的 family 集合：按任务类型路由判定。
      // 走云端的 LLM 任务不再预加载本地 LLM（G4：避免白占 3–4GB 内存）
      const localFamilies = await resolveLocalFamilies(flatTasks, (task) =>
        modelRouter.route(task),
      );

      try {
        for (const layer of layers) {
          if (this.cancelSignal.cancelled) break;

          // 等待暂停恢复
          while (this.pauseSignal.paused && !this.cancelSignal.cancelled) {
            await this.sleep(500);
          }
          if (this.cancelSignal.cancelled) break;

          Logger.info("[SmartTaskScheduler] 开始执行任务层", { tasks: layer });

          const groups = groupTasksByModelFamily(layer);
          const layerFamilies = collectLayerFamilies(layer);
          const snapshotBefore = getResourceSnapshot();

          // 阶段二：同层不同 family 组在内存允许时真并行（Step 0 后为独立线程）；
          // 内存不足则回退组间串行（D3），行为与改造前一致。
          // CPU 侧再叠一道闸：同层的 CPU-bound 组（reranker / 走 CPU 的 llm）>1 时
          // 并行只是互相抢核心，发热而不提速；限线程后可由配置放开。
          const cpuBoundCount = countCpuBoundFamilies(
            layerFamilies,
            localAiManager.isLlmCpuBound(),
          );
          const { allowCpuBoundParallel } = getSmartTaskConfig();
          const canRunParallel =
            layerFamilies.length > 1 &&
            canLoadModelFamilies(layerFamilies) &&
            (allowCpuBoundParallel || cpuBoundCount <= 1);
          Logger.info("[SmartTaskScheduler] 层内执行模式", {
            layer,
            layerFamilies,
            cpuBoundCount,
            allowCpuBoundParallel,
            canRunParallel,
            snapshotBefore,
          });

          if (canRunParallel) {
            await Promise.all(
              groups.map((group) =>
                this.runGroup(
                  group,
                  context,
                  localFamilies,
                  remainingTasks,
                  results,
                  usedFamilies,
                ),
              ),
            );
          } else {
            for (const group of groups) {
              if (this.cancelSignal.cancelled) break;
              await this.runGroup(
                group,
                context,
                localFamilies,
                remainingTasks,
                results,
                usedFamilies,
              );
            }
          }

          // 同层全部结束后，再按剩余任务统一判定并释放各 family：
          // 并行下若沿用「组跑完即释放」会抽掉仍被同层其他组使用的模型。
          for (const family of selectReleasableFamilies(
            layerFamilies,
            Array.from(remainingTasks),
          )) {
            if (this.cancelSignal.cancelled) break;
            if (handledFamilies.has(family)) continue;
            handledFamilies.add(family);
            await this.releaseFamilyWithStep(
              family,
              taskStepId(layer[layer.length - 1]),
              "after",
            );
          }

          // 层结束即通知渲染层刷新 Wiki：整轮才通知一次时，用户盯着跑完的概念/主题
          // 要到最后才可见（§3.8）。通知自带 800ms 去抖，层间隔远大于它，不会被合并掉。
          notifyWikiUpdated();

          if (canRunParallel) {
            Logger.info("[SmartTaskScheduler] 层并行完成", {
              layer,
              layerFamilies,
              snapshotAfter: getResourceSnapshot(),
            });
          }
        }
      } finally {
        // 兜底：本次用过但尚未产生释放节点的 family 无论成功、失败还是取消都释放（幂等、失败不抛出）
        for (const family of usedFamilies) {
          if (handledFamilies.has(family)) continue;
          await this.releaseFamilyWithStep(family, STEP_DONE_ID);
        }
      }

      // 观测字段：本轮结束时全库的最大 updated_at（不再作选取依据，
      // 各任务改按自己的阶段标记增量选取，见 §3.7）
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
            // 失败条目没写阶段标记，下一轮会自动重试；这里如实报数供 UI 明细使用
            failedCount: r.failedCount ?? 0,
            error: r.error,
          })),
        ),
        // 取消/失败轮不写水位：它记的是「整库跑到哪」，半途取消写入的值不可信
        processed_until:
          finalStatus === "succeeded" ? this.computeProcessedUntil() : null,
      };
      this.taskExecutionDao.update(executionId, update);

      this.status = finalStatus === "succeeded" ? "completed" : finalStatus;
      // 标记步骤明细结束节点与整体状态
      stepManager.completeExecution(this.status);
      // 概念 / 主题等语义数据可能已变化，通知渲染层刷新 Wiki（去抖合并）
      notifyWikiUpdated();
      return { executionId };
    } catch (error) {
      Logger.error("[SmartTaskScheduler] 执行异常", { error: String(error) });
      this.status = "failed";
      if (stepsStarted) {
        stepManager.completeExecution("failed");
      }

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

  /**
   * 执行同层内一个 family 组：按需预加载 → 并行跑组内任务 → 记录结果并更新剩余任务集合。
   * 组内任务彼此无依赖（同层），故用 Promise.all 并行。
   */
  private async runGroup(
    group: { family: ModelFamily | null; tasks: string[] },
    context: TaskContext,
    localFamilies: Set<ModelFamily>,
    remainingTasks: Set<string>,
    results: TaskResult[],
    usedFamilies: Set<ModelFamily>,
  ): Promise<void> {
    if (group.family) usedFamilies.add(group.family);

    // 本地 LLM 仅在路由判定为「走本地」时预加载，避免走云端时白占 3–4GB（G4）
    const needPreload =
      group.family !== null && (group.family !== "llm" || localFamilies.has("llm"));
    if (group.family && needPreload) {
      await this.loadFamilyWithStep(group.family, taskStepId(group.tasks[0]));
    }

    const groupResults = await Promise.all(
      group.tasks.map(async (taskName) => {
        const executor = this.executors.get(taskName);
        if (!executor) {
          Logger.error("[SmartTaskScheduler] 未知任务", { taskName });
          return null;
        }

        stepManager.setStepState(taskStepId(taskName), "running", {
          startedAt: Date.now(),
        });
        Logger.info("[SmartTaskScheduler] 开始执行任务", { taskName });
        let result: TaskResult;
        try {
          result = await executor.run(context);
        } catch (error) {
          Logger.error("[SmartTaskScheduler] 任务执行异常", { taskName, error: String(error) });
          result = {
            taskName,
            success: false,
            processedCount: 0,
            error: String(error),
          };
        }

        progressManager.completeTask(result);
        if (result.success) {
          Logger.info("[SmartTaskScheduler] 任务完成", { taskName, processed: result.processedCount });
        } else {
          Logger.error("[SmartTaskScheduler] 任务失败", { taskName, error: result.error });
          // 任务失败但继续执行后续层（非阻塞，与旧串行逻辑一致）
        }
        return result;
      }),
    );

    results.push(...groupResults.filter((r): r is TaskResult => r !== null));

    // 组内任务已执行，从待执行集合移除
    for (const taskName of group.tasks) {
      remainingTasks.delete(taskName);
    }
  }

  /**
   * 记录"启动模型"节点并显式预加载对应 family 的模型。
   * - 已加载时 loadModel 幂等返回，仍记录节点并标注"复用已加载模型"。
   * - 加载完成后采集系统 CPU / 内存快照；失败仅记日志，不中断后续任务（与旧行为一致）。
   */
  private async loadFamilyWithStep(family: ModelFamily, anchorId: string): Promise<void> {
    const modelId = getFamilyModelId(family);
    if (!modelId) return;

    const wasLoaded = modelManager.getModelStatus(modelId)?.status === "loaded";
    const step = stepManager.insertStepBefore(anchorId, {
      kind: "model-load",
      ref: family,
      family,
      modelId,
    });
    stepManager.setStepState(step.id, "running", { startedAt: Date.now() }, true);

    try {
      await modelManager.loadModel(modelId);
      const snapshot = getResourceSnapshot();
      stepManager.setStepState(
        step.id,
        "success",
        {
          ...snapshot,
          finishedAt: Date.now(),
          ...(wasLoaded ? { reason: "reused" } : {}),
        },
        true,
      );
      Logger.info("[SmartTaskScheduler] 模型已就绪", { family, modelId, wasLoaded });
    } catch (error) {
      Logger.error("[SmartTaskScheduler] 启动模型失败", { family, modelId, error: String(error) });
      stepManager.setStepState(
        step.id,
        "failed",
        { finishedAt: Date.now(), reason: String(error) },
        true,
      );
    }
  }

  /**
   * 记录"释放模型"节点并释放对应 family 的模型。
   * 跳过（在途请求 / 空闲保留期 / 无模型）时节点标记为 skipped。
   */
  private async releaseFamilyWithStep(
    family: ModelFamily,
    anchorId: string,
    place: "before" | "after" = "before",
  ): Promise<void> {
    const modelId = getFamilyModelId(family);
    const init = {
      kind: "model-release" as const,
      ref: family,
      family,
      modelId,
    };
    const step =
      place === "after"
        ? stepManager.insertStepAfter(anchorId, init)
        : stepManager.insertStepBefore(anchorId, init);
    stepManager.setStepState(step.id, "running", { startedAt: Date.now() }, true);

    const outcome = await this.releaseFamily(family);
    if (outcome === "released" || outcome === "failed") {
      const snapshot = getResourceSnapshot();
      stepManager.setStepState(
        step.id,
        outcome === "released" ? "success" : "failed",
        { ...snapshot, finishedAt: Date.now() },
        true,
      );
    } else {
      const reasonCode =
        outcome === "skipped-busy"
          ? "busy"
          : outcome === "skipped-keepalive"
            ? "keepalive"
            : "no-model";
      stepManager.setStepState(
        step.id,
        "skipped",
        { finishedAt: Date.now(), reason: reasonCode },
        true,
      );
    }
  }

  /**
   * 释放某个 family 对应的模型。
   * - LLM 有在途请求（用户对话/润色等本次整理之外的请求）时跳过，交由空闲计时器回收，
   *   避免 unloadLlmModel 的排空逻辑把整理收尾拖到用户流式请求结束。
   * - unloadModel 幂等（未加载时安全、会清除空闲计时器），失败仅记日志不抛出。
   */
  private async releaseFamily(family: ModelFamily): Promise<ReleaseOutcome> {
    if (family === "llm" && localAiManager.isLlmBusy()) {
      Logger.info("[SmartTaskScheduler] 本地 LLM 有在途请求，跳过立即释放", { family });
      return "skipped-busy";
    }

    const modelId = getFamilyModelId(family);
    if (!modelId) return "no-model";

    // 搜索预热等显式设置了保留期的模型不立即释放，交由空闲计时器按保留期回收，
    // 否则一次智能整理就会把搜索模型卸载，导致下次搜索重新冷启动。
    if (modelManager.hasIdleTimeoutOverride(modelId)) {
      Logger.info("[SmartTaskScheduler] 模型设有空闲保留期，跳过立即释放", { family, modelId });
      return "skipped-keepalive";
    }

    try {
      await modelManager.unloadModel(modelId);
      Logger.info("[SmartTaskScheduler] 已释放模型", { family, modelId });
      return "released";
    } catch (error) {
      Logger.error("[SmartTaskScheduler] 释放模型失败", { family, modelId, error: String(error) });
      return "failed";
    }
  }

  /**
   * 全库最大的 `updated_at`，写入执行记录作观测值。
   *
   * 用聚合而不是 findAll 再 reduce：后者会把整库语义块读进内存，
   * 而这里只关心一个时间戳。
   */
  private computeProcessedUntil(): string | null {
    const rows = this.chunkDao.query(
      "SELECT MAX(updated_at) AS max_updated_at FROM semantic_chunks",
    ) as unknown as Array<{ max_updated_at: string | null }>;
    return rows[0]?.max_updated_at ?? null;
  }

  /**
   * 上一轮各任务的实际条数，作为本轮尚未开始步骤的加权预估（§3.8）。
   *
   * `tasks_summary` 正常轮存 `[{ name, processedCount, failedCount }]`，
   * 整轮异常时存 `{ error }` 对象——非数组直接当无历史处理，不预估。
   * 首轮无历史记录时返回空对象，此时 stepManager 回退按步骤数给粗粒度百分比。
   */
  private readEstimatedAmounts(): Record<string, number> {
    return parseEstimatedAmounts(this.taskExecutionDao.findLatest()?.tasks_summary);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default SmartTaskScheduler;
export const smartTaskScheduler = SmartTaskScheduler.getInstance();