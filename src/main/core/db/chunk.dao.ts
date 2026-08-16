import { BaseDao } from "./base.dao";
import {
  Chunk,
  ChunkCreate,
  ChunkUpdate,
  ChunkQuery,
  ChunkId,
  ChunkStatus,
  BooleanFlag,
} from "@/main/types/db";

export class ChunkDao extends BaseDao<Chunk, ChunkCreate, ChunkUpdate> {
  constructor() {
    super("semantic_chunks");
  }

  /**
   * 根据时间衰减分数范围查询 Chunk 列表
   * @param minScore 最低分数
   * @param maxScore 最高分数
   */
  findWithTemporalScoreRange(minScore: number, maxScore: number): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE temporal_score >= ? AND temporal_score <= ? ORDER BY temporal_score DESC`;
    return this.query(sql, [minScore, maxScore]);
  }

  /**
   * 全文搜索 Chunk
   * @param query 搜索关键词 (FTS5 MATCH 语法)
   * @param limit 返回结果数量限制
   */
  searchFts(query: string, limit: number = 50): Chunk[] {
    const sql = `
      SELECT b.* FROM ${this.tableName} b
      JOIN semantic_chunks_fts f ON b.rowid = f.rowid
      WHERE f.content MATCH ? AND b.status = 'active' ORDER BY b.created_at DESC
      LIMIT ?
    `;
    return this.query(sql, [query, limit]);
  }

  /**
   * 获取最近的 Chunk 列表
   * @param limit 返回结果数量限制
   */
  getRecentChunks(limit: number = 50): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`;
    return this.query(sql, [limit]);
  }

  /**
   * 根据日期范围查询 Chunk 列表
   * 按 created_at ASC 排序
   * @param startDate 起始日期（ISO 8601 字符串）
   * @param endDate 结束日期（ISO 8601 字符串）
   * @param status 可选的 chunk 状态过滤
   *   - undefined：查询所有 chunk
   *   - 具体状态：查询指定状态的 chunk
   */
  findByDateRange(
    startDate: string,
    endDate: string,
    status?: ChunkStatus,
  ): Chunk[] {
    let sql: string;
    const params: unknown[] = [startDate, endDate];

    if (status !== undefined) {
      sql = `SELECT * FROM ${this.tableName} WHERE created_at >= ? AND created_at <= ? AND status = ? ORDER BY created_at DESC`;
      params.push(status);
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`;
    }

    return this.query(sql, params);
  }

  /**
   * 按时间衰减分数排序获取 Chunk 列表
   * @param limit 返回结果数量限制
   */
  getChunksWithTemporalScore(limit: number = 50): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'active' ORDER BY temporal_score DESC LIMIT ?`;
    return this.query(sql, [limit]);
  }

  /**
   * 设置 Chunk 的字数
   * @param id Chunk ID
   * @param count 字数
   */
  setWordCount(id: string, count: number): number {
    const sql = `UPDATE ${this.tableName} SET word_count = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([count, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 更新 Chunk 的时间衰减分数
   * @param id Chunk ID
   * @param score 时间衰减分数
   */
  updateTemporalScore(id: string, score: number): number {
    const sql = `UPDATE ${this.tableName} SET temporal_score = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([score, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 设置单个 Chunk 的软删除状态（独立方法，不注册 IPC）
   * @param id Chunk ID
   * @param isDeleted 是否删除 (0 | 1)
   */
  setDeleted(id: ChunkId, isDeleted: BooleanFlag): number {
    if (!id || id.trim() === "") return 0;
    const safeValue: number = isDeleted ? 1 : 0;
    const sql = `UPDATE ${this.tableName} SET status = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([safeValue, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 批量设置 Chunk 的删除状态（独立方法，不注册 IPC）
   * 在事务中执行，确保原子性
   * @param ids Chunk ID 数组
   * @param isDeleted 是否删除 (0 | 1)
   * @returns 实际受影响的行数
   */
  setDeletedBatch(ids: ChunkId[], isDeleted: BooleanFlag): number {
    if (!ids || ids.length === 0) return 0;
    const safeValue: number = isDeleted ? 1 : 0;
    return this.transaction(() => {
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `UPDATE ${this.tableName} SET is_deleted = ?, updated_at = ? WHERE id IN (${placeholders})`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run([safeValue, this.getCurrentTimestamp(), ...ids]);
      return result.changes;
    });
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ChunkQuery): {
    sql: string;
    values: unknown[];
  } {
    const conditionsArray: string[] = [];
    const values: unknown[] = [];

    if (conditions.status !== undefined) {
      conditionsArray.push("status = ?");
      values.push(conditions.status);
    }
    if (conditions.is_deleted !== undefined) {
      conditionsArray.push("is_deleted = ?");
      values.push(conditions.is_deleted);
    }
    if (conditions.temporal_score_min !== undefined) {
      conditionsArray.push("temporal_score >= ?");
      values.push(conditions.temporal_score_min);
    }
    if (conditions.temporal_score_max !== undefined) {
      conditionsArray.push("temporal_score <= ?");
      values.push(conditions.temporal_score_max);
    }

    const sql =
      conditionsArray.length > 0 ? conditionsArray.join(" AND ") : "1=1";
    return { sql, values };
  }
}
