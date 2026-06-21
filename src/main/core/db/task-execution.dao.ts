import { BaseDao } from "./base.dao";
import {
  TaskExecutionLog,
  TaskExecutionCreate,
  TaskExecutionUpdate,
} from "@/main/types/db";

export class TaskExecutionDao extends BaseDao<
  TaskExecutionLog,
  TaskExecutionCreate,
  TaskExecutionUpdate
> {
  constructor() {
    super("task_execution_log");
  }

  /** 查询最近一次成功执行记录 */
  public findLatestSucceeded(): TaskExecutionLog | undefined {
    return this.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE status = 'succeeded' ORDER BY started_at DESC LIMIT 1`,
      )
      .get() as TaskExecutionLog | undefined;
  }

  /** 查询最近一次执行记录（不限状态） */
  public findLatest(): TaskExecutionLog | undefined {
    return this.db
      .prepare(
        `SELECT * FROM ${this.tableName} ORDER BY started_at DESC LIMIT 1`,
      )
      .get() as TaskExecutionLog | undefined;
  }

  /** 根据状态查询 */
  public findByStatus(status: string): TaskExecutionLog[] {
    return this.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE status = ? ORDER BY started_at DESC`,
      )
      .all(status) as TaskExecutionLog[];
  }
}