/**
 * 智能整理步骤管理器
 * 维护按执行顺序排列的步骤明细（准备 / 启动模型 / 执行任务 / 释放模型 / 结束），
 * 并向渲染进程推送快照，供 AppHeader 进度提示与节点明细面板使用。
 */
import { BrowserWindow } from "electron";
import type {
  SmartTaskStep,
  SmartTaskStepState,
  SmartTaskSnapshot,
  SmartTaskRunStatus,
  TaskResult,
} from "./types";
import { Logger } from "@/main/utils/logger";

/** 推送通道 */
export const SMART_TASK_SNAPSHOT_CHANNEL = "smart-task:snapshot";

/** 固定步骤 id */
export const STEP_PREPARE_ID = "prepare";
export const STEP_DONE_ID = "done";

/** 任务步骤 id */
export function taskStepId(taskName: string): string {
  return `task:${taskName}`;
}

/** 步骤初始化入参（id/state 可省略，由管理器补全） */
export type StepInit = Pick<SmartTaskStep, "kind" | "ref"> &
  Partial<Omit<SmartTaskStep, "kind" | "ref">>;

class StepManager {
  private executionId: string | null = null;
  private status: SmartTaskRunStatus = "idle";
  /** 数组顺序即展示顺序 */
  private steps: SmartTaskStep[] = [];
  private modelStepSeq = 0;

  private lastPushTime = 0;
  private pushTimer: NodeJS.Timeout | null = null;
  private readonly PUSH_THROTTLE_MS = 200;

  /** 开始一次执行：重置并 seed 准备节点、各任务节点与结束节点 */
  public beginExecution(
    executionId: string,
    taskNames: string[],
    estimatedAmounts?: Record<string, number>,
  ): void {
    this.reset();
    this.executionId = executionId;
    this.status = "running";

    const now = Date.now();
    this.steps.push({
      id: STEP_PREPARE_ID,
      kind: "prepare",
      ref: STEP_PREPARE_ID,
      state: "success",
      startedAt: now,
      finishedAt: now,
    });
    for (const name of taskNames) {
      this.steps.push({
        id: taskStepId(name),
        kind: "task",
        ref: name,
        state: "pending",
        // 尚未开始的步骤先带上一轮的实际条数作权重，见 computeOverallPercent
        dataAmount: estimatedAmounts?.[name],
      });
    }
    this.steps.push({
      id: STEP_DONE_ID,
      kind: "done",
      ref: STEP_DONE_ID,
      state: "pending",
    });

    this.push(true);
  }

  /** 在指定步骤之前插入步骤（beforeId 为空或不存在时追加到末尾） */
  public insertStepBefore(beforeId: string | null, init: StepInit): SmartTaskStep {
    const step = this.createStep(init);
    const idx = beforeId ? this.steps.findIndex((s) => s.id === beforeId) : -1;
    if (idx < 0) {
      this.steps.push(step);
    } else {
      this.steps.splice(idx, 0, step);
    }
    return step;
  }

  /** 在指定步骤之后插入步骤（afterId 为空或不存在时追加到末尾） */
  public insertStepAfter(afterId: string | null, init: StepInit): SmartTaskStep {
    const step = this.createStep(init);
    const idx = afterId ? this.steps.findIndex((s) => s.id === afterId) : -1;
    if (idx < 0) {
      this.steps.push(step);
    } else {
      this.steps.splice(idx + 1, 0, step);
    }
    return step;
  }

  /** 更新步骤状态及概要字段 */
  public setStepState(
    id: string,
    state: SmartTaskStepState,
    patch?: Partial<SmartTaskStep>,
    force = false,
  ): void {
    const step = this.steps.find((s) => s.id === id);
    if (!step) return;
    step.state = state;
    if (patch) Object.assign(step, patch);
    this.push(force);
  }

  /** 任务进度：由 progressManager 转发，填充数据量与已处理条数 */
  public updateTaskProgress(taskName: string, current: number, total: number): void {
    const step = this.steps.find((s) => s.id === taskStepId(taskName));
    if (!step) return;
    step.dataAmount = total;
    step.processedCount = current;
    this.push(false);
  }

  /** 任务完成：由 progressManager 转发，写入终态与处理结果 */
  public completeTask(result: TaskResult): void {
    const step = this.steps.find((s) => s.id === taskStepId(result.taskName));
    if (!step) return;
    step.state = result.success ? "success" : "failed";
    step.processedCount = result.processedCount;
    // 失败条目没写阶段标记，下一轮自动重试；这里如实带上，供 UI 明细区分「没活干」与「干砸了」
    if (result.failedCount !== undefined) step.failedCount = result.failedCount;
    if (result.error) step.reason = result.error;
    step.finishedAt = Date.now();
    this.push(true);
  }

  /** 结束执行：标记结束节点与整体状态 */
  public completeExecution(status: SmartTaskRunStatus): void {
    this.status = status;
    const done = this.steps.find((s) => s.id === STEP_DONE_ID);
    if (done) {
      if (status === "completed") {
        done.state = "success";
      } else if (status === "failed") {
        done.state = "failed";
      } else {
        done.state = "skipped";
      }
      done.finishedAt = Date.now();
    }
    this.push(true);
  }

  /** 获取当前快照 */
  public getSnapshot(): SmartTaskSnapshot {
    return {
      executionId: this.executionId,
      status: this.status,
      overallPercent: this.computeOverallPercent(),
      steps: this.steps.map((s) => ({ ...s })),
    };
  }

  /** 重置 */
  public reset(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.executionId = null;
    this.status = "idle";
    this.steps = [];
    this.modelStepSeq = 0;
    this.lastPushTime = 0;
  }

  /**
   * 按数据量加权的进度（已处理数 / 总数），整体百分比与 progressManager 共用这一个口径。
   *
   * 原先按「已完成步骤数 / 步骤总数」算，于是「1000 块的向量化」和「3 块的主题摘要」
   * 等值，进度条要么长时间不动要么一步跳到 80%。改为每步权重取其数据量：
   * - 已开始/已结束的步骤用本轮真实条数；
   * - 尚未开始的步骤用上一轮的实际条数预估（由 scheduler 传入）。
   *
   * 步骤结束时权重换成「本轮实际尝试数」而不是保留预估值：本轮无活可干的步骤
   * （预估 1200、实际 0）若继续占权重，进度条会永远停在 100% 之前。
   * 全程单调不减：预估只会随步骤结束而被实际值替换，实际值 ≤ 预估时总量收缩、百分比上跳。
   */
  public getWeightedProgress(): { done: number; total: number } {
    const taskSteps = this.steps.filter((s) => s.kind === "task");

    let total = 0;
    let done = 0;
    for (const step of taskSteps) {
      const attempted = (step.processedCount ?? 0) + (step.failedCount ?? 0);
      if (step.state === "success" || step.state === "failed") {
        total += attempted;
        done += attempted;
        continue;
      }
      const weight = step.dataAmount ?? 0;
      total += weight;
      done += Math.min(step.processedCount ?? 0, weight);
    }
    return { done, total };
  }

  /** 加权整体百分比；无历史预估且本轮尚无条数产出时回退按步骤数 */
  private computeOverallPercent(): number {
    const { done, total } = this.getWeightedProgress();
    if (total > 0) return Math.round((done / total) * 100);

    const taskSteps = this.steps.filter((s) => s.kind === "task");
    if (taskSteps.length === 0) return 0;
    const completed = taskSteps.filter(
      (s) => s.state === "success" || s.state === "failed",
    ).length;
    return Math.round((completed / taskSteps.length) * 100);
  }

  private createStep(init: StepInit): SmartTaskStep {
    const { id, state, ...rest } = init;
    return {
      id: id ?? `${init.kind}:${init.ref}#${++this.modelStepSeq}`,
      state: state ?? "pending",
      ...rest,
    };
  }

  /** 推送快照到渲染进程（默认 200ms 节流，force 时立即推送） */
  private push(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastPushTime < this.PUSH_THROTTLE_MS) {
      if (!this.pushTimer) {
        this.pushTimer = setTimeout(() => {
          this.pushTimer = null;
          this.push(true);
        }, this.PUSH_THROTTLE_MS);
        this.pushTimer.unref?.();
      }
      return;
    }

    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.lastPushTime = now;

    const snapshot = this.getSnapshot();
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send(SMART_TASK_SNAPSHOT_CHANNEL, snapshot);
      } catch (error) {
        Logger.error("[StepManager] 推送快照失败", { error: String(error) });
      }
    }
  }
}

export default StepManager;
export const stepManager = new StepManager();