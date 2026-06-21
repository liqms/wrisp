import { generateId } from "@/shared/utils";
import { TimeUtil } from "@/shared/utils";
import { TaskDao } from "@/main/core/db/task.dao";
import type { Task, TaskStatus, EnqueueTaskInput } from "@/shared/types/task.types";
import type { TaskRow, TaskCreate, TaskUpdate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export interface PendingTaskSummary {
  count: number;
  types: string[];
  groups: string[];
}

export class TaskQueue {
  private dao: TaskDao;
  private enqueueCallbacks: Array<() => void> = [];

  constructor() {
    this.dao = new TaskDao();
  }

  /** 注册入队回调（用于通知执行器唤醒） */
  onEnqueue(callback: () => void): void {
    this.enqueueCallbacks.push(callback);
  }

  /** 入队 */
  async enqueue(input: EnqueueTaskInput): Promise<string> {
    const id = generateId();

    const create: TaskCreate = {
      id,
      type: input.type,
      status: "pending",
      payload: JSON.stringify(input.payload),
      priority: input.priority ?? 0,
      max_retries: input.maxRetries ?? 3,
      group_id: input.groupId ?? null,
      depends_on: input.dependsOn ?? null,
    };

    this.dao.create(create);
    Logger.info("[TaskQueue] 任务入队", { id, type: input.type });

    // 通知监听者（执行器唤醒）
    this.enqueueCallbacks.forEach((cb) => cb());

    return id;
  }

  /** 出队：按优先级取出一个 pending 任务并标记为 running */
  async dequeue(): Promise<Task | null> {
    const pendingTasks = this.dao.findPendingByPriority();
    if (pendingTasks.length === 0) return null;

    const row = pendingTasks[0];
    const now = TimeUtil.toISOString(Date.now());

    this.dao.update(row.id, { status: "running", started_at: now });
    return this.rowToTask({ ...row, status: "running", started_at: now });
  }

  /** 更新任务状态 */
  async updateStatus(id: string, status: TaskStatus, result?: unknown, error?: string): Promise<void> {
    const now = TimeUtil.toISOString(Date.now());
    const update: TaskUpdate = {
      status,
      result: result ? JSON.stringify(result) : undefined,
      error_message: error ?? undefined,
    };

    if (status === "succeeded" || status === "failed" || status === "cancelled") {
      update.finished_at = now;
    }

    this.dao.update(id, update);
    Logger.info("[TaskQueue] 任务状态更新", { id, status });
  }

  /** 取消任务 */
  async cancel(id: string): Promise<void> {
    const task = this.dao.findById(id);
    if (!task) return;

    if (task.status === "pending" || task.status === "running") {
      await this.updateStatus(id, "cancelled");
    }
  }

  /** 获取任务 */
  async getTask(id: string): Promise<Task | null> {
    const row = this.dao.findById(id);
    return row ? this.rowToTask(row) : null;
  }

  /** 按分组查询 */
  async getTasksByGroup(groupId: string): Promise<Task[]> {
    const rows = this.dao.findByGroupId(groupId);
    return rows.map((r) => this.rowToTask(r));
  }

  /** 重置所有 running 任务为 pending */
  async resetRunningTasks(): Promise<void> {
    const count = this.dao.resetRunningToPending();
    if (count > 0) {
      Logger.info("[TaskQueue] 恢复中断任务", { count });
    }
  }

  /** 统计待处理任务数量 */
  countPending(): number {
    return this.dao.countByStatus("pending");
  }

  /** 获取待处理任务摘要（用于确认弹窗） */
  getPendingSummary(): PendingTaskSummary {
    const tasks = this.dao.findByStatus("pending");
    const types = [...new Set(tasks.map((t) => t.type))];
    const groups = [...new Set(tasks.map((t) => t.group_id).filter(Boolean))];
    return {
      count: tasks.length,
      types,
      groups: groups as string[],
    };
  }

  /** 将 DAO 行转换为 Task 接口 */
  private rowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      type: row.type,
      status: row.status as TaskStatus,
      payload: row.payload,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      errorMessage: row.error_message,
      result: row.result,
      groupId: row.group_id,
      dependsOn: row.depends_on,
    };
  }
}