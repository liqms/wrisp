/**
 * 进度管理器
 * 负责计算和推送任务执行进度
 */
import { BrowserWindow } from "electron";
import { ProgressUpdate, TaskResult } from "./types";
import { Logger } from "@/main/utils/logger";

class ProgressManager {
  private taskProgress = new Map<string, { current: number; total: number }>();
  private taskResults: TaskResult[] = [];
  private totalTaskCount = 0;

  /** 注册所有任务的预计总数 */
  public registerTasks(taskNames: string[]): void {
    this.totalTaskCount = taskNames.length;
    this.taskProgress.clear();
    this.taskResults = [];
    for (const name of taskNames) {
      this.taskProgress.set(name, { current: 0, total: 1 });
    }
  }

  /** 更新某个任务的进度 */
  public update(taskName: string, current: number, total: number): void {
    this.taskProgress.set(taskName, { current, total });
    this.pushProgress();
  }

  /** 记录任务完成 */
  public completeTask(result: TaskResult): void {
    this.taskResults.push(result);
    const p = this.taskProgress.get(result.taskName);
    if (p) {
      p.current = p.total;
    }
    this.pushProgress();
  }

  /** 获取当前进度 */
  public getProgress(): ProgressUpdate | null {
    if (this.taskProgress.size === 0) return null;

    let totalWeight = 0;
    let completedWeight = 0;

    for (const [, p] of this.taskProgress) {
      totalWeight += p.total;
      completedWeight += p.current;
    }

    const overallPercent = totalWeight > 0
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;

    // 按已完成任务数计算整体百分比（更直观）
    const taskBasedPercent = this.totalTaskCount > 0
      ? Math.round((this.taskResults.length / this.totalTaskCount) * 100)
      : overallPercent;

    return {
      taskName: this.taskResults.length > 0
        ? this.taskResults[this.taskResults.length - 1].taskName
        : "准备中",
      current: completedWeight,
      total: totalWeight,
      overallPercent: taskBasedPercent,
    };
  }

  /** 获取已完成任务数 */
  public getCompletedCount(): number {
    return this.taskResults.length;
  }

  /** 获取总任务数 */
  public getTotalCount(): number {
    return this.totalTaskCount;
  }

  /** 获取任务结果列表 */
  public getResults(): TaskResult[] {
    return [...this.taskResults];
  }

  /** 重置 */
  public reset(): void {
    this.taskProgress.clear();
    this.taskResults = [];
    this.totalTaskCount = 0;
  }

  /** 推送进度到渲染进程 */
  private pushProgress(): void {
    const progress = this.getProgress();
    if (!progress) return;

    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      try {
        win.webContents.send("smart-task:progress", progress);
      } catch (error) {
        Logger.error("[ProgressManager] 推送进度失败", { error: String(error) });
      }
    }
  }
}

export default ProgressManager;
export const progressManager = new ProgressManager();