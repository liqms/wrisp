/**
 * 进度管理器
 * 汇总各任务上报的条数，写入步骤明细并推送快照。
 *
 * 整体百分比一律来自 stepManager（唯一加权口径）；本类不再自行换算，
 * 也不另发 `smart-task:progress` 通道 —— 渲染层只订阅 `smart-task:snapshot`，
 * 两套口径并存正是「进度条跳变」的来源。
 */
import { ProgressUpdate, TaskResult } from "./types";
import { stepManager } from "./step.manager";

class ProgressManager {
  private taskProgress = new Map<string, { current: number; total: number }>();
  private taskResults: TaskResult[] = [];

  /** 注册本轮要执行的任务 */
  public registerTasks(taskNames: string[]): void {
    this.taskProgress.clear();
    this.taskResults = [];
    for (const name of taskNames) {
      this.taskProgress.set(name, { current: 0, total: 1 });
    }
  }

  /** 更新某个任务的进度（推送到渲染层由 stepManager 统一节流） */
  public update(taskName: string, current: number, total: number): void {
    this.taskProgress.set(taskName, { current, total });
    // 同步到步骤明细：填充"执行任务"节点的数据量与已处理条数
    stepManager.updateTaskProgress(taskName, current, total);
  }

  /** 记录任务完成 */
  public completeTask(result: TaskResult): void {
    this.taskResults.push(result);
    // 同步到步骤明细：写入任务终态与处理结果
    stepManager.completeTask(result);
  }

  /** 获取当前进度 */
  public getProgress(): ProgressUpdate | null {
    if (this.taskProgress.size === 0) return null;

    const { done, total } = stepManager.getWeightedProgress();

    return {
      taskName: this.taskResults.length > 0
        ? this.taskResults[this.taskResults.length - 1].taskName
        : "准备中",
      current: done,
      total,
      overallPercent: stepManager.getSnapshot().overallPercent,
    };
  }

  /** 获取任务结果列表 */
  public getResults(): TaskResult[] {
    return [...this.taskResults];
  }

  /** 重置 */
  public reset(): void {
    this.taskProgress.clear();
    this.taskResults = [];
  }
}

export default ProgressManager;
export const progressManager = new ProgressManager();