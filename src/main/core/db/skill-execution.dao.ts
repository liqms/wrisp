import { BaseDao } from "./base.dao";
import type { SkillExecutionRecord } from "@/shared/types/skill.types";

interface SkillExecutionCreate {
  id: string;
  skill_id: string;
  input: string;
  output: string;
  level: string;
  model_used: string;
  tokens_used: number;
  execution_time_ms: number;
  steps?: number;
  status: string;
  error_message?: string;
  created_at: string;
}

type SkillExecutionRow = SkillExecutionCreate;

export class SkillExecutionDao extends BaseDao<SkillExecutionRow, SkillExecutionCreate, Partial<SkillExecutionCreate>> {
  constructor() {
    super("skill_executions", { enabled: false }); // 手动管理时间戳
  }

  /**
   * 插入执行记录
   */
  public insertRecord(record: SkillExecutionRecord): void {
    const row: SkillExecutionCreate = {
      id: record.id,
      skill_id: record.skillId,
      input: record.input,
      output: record.output,
      level: record.level,
      model_used: record.modelUsed,
      tokens_used: record.tokensUsed,
      execution_time_ms: record.executionTimeMs,
      steps: record.steps,
      status: record.status,
      error_message: record.errorMessage,
      created_at: record.createdAt,
    };
    this.create(row);
  }

  /**
   * 按 Skill ID 查询执行历史（最近 N 条）
   */
  public getBySkillId(skillId: string, limit: number = 20): SkillExecutionRecord[] {
    const rows = this.query(
      `SELECT * FROM ${this.tableName} WHERE skill_id = ? ORDER BY created_at DESC LIMIT ?`,
      [skillId, limit],
    );
    return rows.map(this.toRecord);
  }

  /**
   * 获取最近执行记录
   */
  public getRecent(limit: number = 20): SkillExecutionRecord[] {
    const rows = this.query(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map(this.toRecord);
  }

  /**
   * 清理超过指定天数的旧记录
   */
  public deleteOlderThan(days: number): number {
    const result = this.db
      .prepare(
        `DELETE FROM ${this.tableName} WHERE created_at < datetime('now', ?)`,
      )
      .run(`-${days} days`);
    return result.changes;
  }

  /**
   * 获取执行统计
   */
  public getStats(skillId?: string): { total: number; succeeded: number; failed: number; avgTimeMs: number } {
    const whereClause = skillId ? "WHERE skill_id = ?" : "";
    const params = skillId ? [skillId] : [];

    const row = this.db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as succeeded,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          AVG(execution_time_ms) as avg_time_ms
        FROM ${this.tableName} ${whereClause}`,
      )
      .get(...params) as { total: number; succeeded: number; failed: number; avg_time_ms: number } | undefined;

    return {
      total: row?.total ?? 0,
      succeeded: row?.succeeded ?? 0,
      failed: row?.failed ?? 0,
      avgTimeMs: Math.round(row?.avg_time_ms ?? 0),
    };
  }

  private toRecord(row: SkillExecutionRow): SkillExecutionRecord {
    return {
      id: row.id,
      skillId: row.skill_id,
      input: row.input,
      output: row.output,
      level: row.level as "L1" | "L2",
      modelUsed: row.model_used,
      tokensUsed: row.tokens_used,
      executionTimeMs: row.execution_time_ms,
      steps: row.steps,
      status: row.status as "succeeded" | "failed",
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}

export const skillExecutionDao = new SkillExecutionDao();