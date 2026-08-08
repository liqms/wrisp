import { BaseDao } from "./base.dao";
import {
  Chunk,
  ChunkCreate,
  ChunkUpdate,
  ChunkQuery,
  JournalSource,
  ContentType,
  Language,
  ChunkId,
  ChunkStatus,
  BooleanFlag,
} from "@/main/types/db";

type FindByField = "source" | "content_type" | "language" | "status";
type CountByField = "source" | "content_type";

export class ChunkDao extends BaseDao<Chunk, ChunkCreate, ChunkUpdate> {
  constructor() {
    super("blocks");
  }

  /**
   * 根据指定字段查询 Chunk 列表
   * @param field 查询字段 (source | content_type | language | status)
   * @param value 字段值
   */
  findBy(
    field: FindByField,
    value: JournalSource | ContentType | Language | ChunkStatus,
  ): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY created_at DESC`;
    return this.query(sql, [value]);
  }

  /**
   * 根据父 Chunk ID 查询子 Chunk 列表
   * @param parentChunkId 父 Chunk ID
   */
  findByParentChunk(parentChunkId: ChunkId): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE parent_chunk_id = ? ORDER BY split_index ASC`;
    return this.query(sql, [parentChunkId]);
  }

  /**
   * 根据多个父 Chunk ID 批量查询子 Chunk 列表
   * @param parentChunkIds 父 Chunk ID 数组
   */
  findByParentChunks(parentChunkIds: ChunkId[]): Chunk[] {
    if (!parentChunkIds || parentChunkIds.length === 0) return [];
    const placeholders = parentChunkIds.map(() => "?").join(", ");
    const sql = `SELECT * FROM ${this.tableName} WHERE parent_chunk_id IN (${placeholders}) ORDER BY parent_chunk_id ASC, split_index ASC`;
    return this.query(sql, parentChunkIds as unknown[]);
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
   * @param parentChunkId 可选的父 chunk ID 过滤
   *   - undefined：搜索所有 chunk
   *   - null：搜索所有子 chunk（parent_chunk_id IS NOT NULL）
   *   - 具体 ID：搜索指定父 chunk 下的子 chunk
   */
  searchFts(
    query: string,
    limit: number = 50,
    parentChunkId?: ChunkId | null,
  ): Chunk[] {
    let sql: string;
    const params: unknown[] = [query];

    if (parentChunkId !== undefined) {
      if (parentChunkId === null) {
        sql = `
          SELECT b.* FROM ${this.tableName} b
          JOIN blocks_fts f ON b.rowid = f.rowid
          WHERE f.content MATCH ? AND b.parent_chunk_id IS NOT NULL AND b.status = 'active' ORDER BY b.created_at DESC
          LIMIT ?
        `;
      } else {
        sql = `
          SELECT b.* FROM ${this.tableName} b
          JOIN blocks_fts f ON b.rowid = f.rowid
          WHERE f.content MATCH ? AND b.parent_chunk_id = ? AND b.status = 'active' ORDER BY b.created_at DESC
          LIMIT ?
        `;
        params.push(parentChunkId);
      }
      params.push(limit);
    } else {
      sql = `
        SELECT b.* FROM ${this.tableName} b
        JOIN blocks_fts f ON b.rowid = f.rowid
        WHERE f.content MATCH ? AND b.status = 'active' ORDER BY b.created_at DESC
        LIMIT ?
      `;
      params.push(limit);
    }

    return this.query(sql, params);
  }

  /**
   * 获取最近的 Chunk 列表
   * @param limit 返回结果数量限制
   * @param parentChunkId 可选的父 chunk ID 过滤
   *   - undefined：获取所有 chunk，按 created_at DESC 排序
   *   - null：获取所有子 chunk，按 created_at ASC, split_index ASC 排序
   *   - 具体 ID：获取指定父 chunk 下的子 chunk，按 created_at ASC, split_index ASC 排序
   */
  getRecentChunks(limit: number = 50, parentChunkId?: ChunkId | null): Chunk[] {
    let sql: string;
    const params: unknown[] = [];

    if (parentChunkId !== undefined) {
      if (parentChunkId === null) {
        sql = `SELECT * FROM ${this.tableName} WHERE parent_chunk_id IS NOT NULL AND status = 'active' ORDER BY created_at ASC, split_index ASC LIMIT ?`;
      } else {
        sql = `SELECT * FROM ${this.tableName} WHERE parent_chunk_id = ? AND status = 'active' ORDER BY created_at ASC, split_index ASC LIMIT ?`;
        params.push(parentChunkId);
      }
      params.push(limit);
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);
    }

    return this.query(sql, params);
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
      sql = `SELECT * FROM ${this.tableName} WHERE created_at >= ? AND created_at <= ? AND status = 'active' ORDER BY created_at DESC`;
      params.push(status);
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE created_at >= ? AND created_at <= ? AND status = ? ORDER BY created_at DESC`;
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
   * 批量设置 Chunk 的归档状态（独立方法，不注册 IPC）
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
   * 根据指定字段统计 Chunk 数量
   * @param field 统计字段 (source | content_type)
   * @param value 字段值
   */
  countBy(field: CountByField, value: JournalSource | ContentType): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`;
    const result = this.queryOne(sql, [value]) as unknown as { count: number };
    return result?.count || 0;
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

    if (conditions.source !== undefined) {
      conditionsArray.push("source = ?");
      values.push(conditions.source);
    }
    if (conditions.content_type !== undefined) {
      conditionsArray.push("content_type = ?");
      values.push(conditions.content_type);
    }
    if (conditions.language !== undefined) {
      conditionsArray.push("language = ?");
      values.push(conditions.language);
    }
    if (conditions.parent_chunk_id !== undefined) {
      if (conditions.parent_chunk_id === null) {
        conditionsArray.push("parent_chunk_id IS NULL");
      } else {
        conditionsArray.push("parent_chunk_id = ?");
        values.push(conditions.parent_chunk_id);
      }
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