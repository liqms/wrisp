import { BaseDao } from "./base.dao";
import {
  TaskRow,
  TaskCreate,
  TaskUpdate,
  TaskStatus,
} from "@/main/types/db";

export class TaskDao extends BaseDao<TaskRow, TaskCreate, TaskUpdate> {
  constructor() {
    super("tasks");
  }

  /** 按优先级获取待处理任务（过滤依赖未完成的） */
  public findPendingByPriority(): TaskRow[] {
    return this.db
      .prepare(
        `SELECT t.* FROM ${this.tableName} t
         WHERE t.status = 'pending'
         AND (t.depends_on IS NULL OR t.depends_on = '' OR EXISTS (
           SELECT 1 FROM ${this.tableName} d WHERE d.id = t.depends_on AND d.status = 'succeeded'
         ))
         ORDER BY t.priority ASC, t.created_at ASC`
      )
      .all() as TaskRow[];
  }

  /** 按分组ID查询 */
  public findByGroupId(groupId: string): TaskRow[] {
    return this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE group_id = ? ORDER BY created_at ASC`)
      .all(groupId) as TaskRow[];
  }

  /** 将所有 running 状态的任务重置为 pending */
  public resetRunningToPending(): number {
    const result = this.db
      .prepare(
        `UPDATE ${this.tableName} SET status = 'pending', updated_at = ? WHERE status = 'running'`
      )
      .run(this.getCurrentTimestamp());
    return result.changes;
  }

  /** 按状态统计数量 */
  public countByStatus(status: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = ?`)
      .get(status) as { count: number } | undefined;
    return row?.count ?? 0;
  }
  public findByStatus(status: TaskStatus): TaskRow[] {
    return this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE status = ? ORDER BY priority ASC, created_at ASC`)
      .all(status) as TaskRow[];
  }
}