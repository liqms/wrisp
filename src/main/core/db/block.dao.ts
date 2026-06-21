import { BaseDao } from "./base.dao";
import {
  Block,
  BlockCreate,
  BlockUpdate,
  BlockQuery,
  CaptureSource,
  ContentType,
  Language,
  BlockId,
  BlockStatus,
  BooleanFlag,
} from "@/main/types/db";

type FindByField = "source" | "content_type" | "language" | "status";
type CountByField = "source" | "content_type";

export class BlockDao extends BaseDao<Block, BlockCreate, BlockUpdate> {
  constructor () {
    super("blocks");
  }

  /**
   * 根据指定字段查询 Block 列表
   * @param field 查询字段 (source | content_type | language | status)
   * @param value 字段值
   */
  findBy(
    field: FindByField,
    value: CaptureSource | ContentType | Language | BlockStatus,
  ): Block[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY created_at DESC`;
    return this.query(sql, [value]);
  }

  /**
   * 根据父 Block ID 查询子 Block 列表
   * @param parentBlockId 父 Block ID
   */
  findByParentBlock(parentBlockId: BlockId): Block[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE parent_block_id = ? ORDER BY split_index ASC`;
    return this.query(sql, [parentBlockId]);
  }

  /**
   * 根据多个父 Block ID 批量查询子 Block 列表
   * @param parentBlockIds 父 Block ID 数组
   */
  findByParentBlocks(parentBlockIds: BlockId[]): Block[] {
    if (!parentBlockIds || parentBlockIds.length === 0) return [];
    const placeholders = parentBlockIds.map(() => "?").join(", ");
    // 按 parent_block_id 分组并按 split_index 排序，便于后续按父 ID 分组处理
    const sql = `SELECT * FROM ${this.tableName} WHERE parent_block_id IN (${placeholders}) ORDER BY parent_block_id ASC, split_index ASC`; 
    return this.query(sql, parentBlockIds as unknown[]);
  }

  /**
   * 根据时间衰减分数范围查询 Block 列表
   * @param minScore 最低分数
   * @param maxScore 最高分数
   */
  findWithTemporalScoreRange(minScore: number, maxScore: number): Block[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE temporal_score >= ? AND temporal_score <= ? ORDER BY temporal_score DESC`;
    return this.query(sql, [minScore, maxScore]);
  }

  /**
   * 全文搜索 Block
   * @param query 搜索关键词 (FTS5 MATCH 语法)
   * @param limit 返回结果数量限制
   * @param parentBlockId 可选的父 block ID 过滤
   *   - undefined：搜索所有 block
   *   - null：搜索所有子 block（parent_block_id IS NOT NULL）
   *   - 具体 ID：搜索指定父 block 下的子 block
   */
  searchFts(
    query: string,
    limit: number = 50,
    parentBlockId?: BlockId | null,
  ): Block[] {
    let sql: string;
    const params: unknown[] = [query];

    if (parentBlockId !== undefined) {
      // 子 Block 搜索（包含父 Block ID 过滤）
      if (parentBlockId === null) {
        sql = `
          SELECT b.* FROM ${this.tableName} b
          JOIN blocks_fts f ON b.rowid = f.rowid
          WHERE f.content MATCH ? AND b.parent_block_id IS NOT NULL ORDER BY b.created_at DESC
          LIMIT ?
        `;
      } else {
        sql = `
          SELECT b.* FROM ${this.tableName} b
          JOIN blocks_fts f ON b.rowid = f.rowid
          WHERE f.content MATCH ? AND b.parent_block_id = ? ORDER BY b.created_at DESC
          LIMIT ?
        `;
        params.push(parentBlockId);
      }
      params.push(limit);
    } else {
      sql = `
        SELECT b.* FROM ${this.tableName} b
        JOIN blocks_fts f ON b.rowid = f.rowid
        WHERE f.content MATCH ? ORDER BY b.created_at DESC
        LIMIT ?
      `;
      params.push(limit);
    }

    return this.query(sql, params);
  }

  /**
   * 获取最近的 Block 列表
   * @param limit 返回结果数量限制
   * @param parentBlockId 可选的父 block ID 过滤
   *   - undefined：获取所有 block，按 created_at DESC 排序
   *   - null：获取所有子 block，按 created_at ASC, split_index ASC 排序
   *   - 具体 ID：获取指定父 block 下的子 block，按 created_at ASC, split_index ASC 排序
   */
  getRecentBlocks(limit: number = 50, parentBlockId?: BlockId | null): Block[] {
    let sql: string;
    const params: unknown[] = [];

    if (parentBlockId !== undefined) {
      if (parentBlockId === null) {
        sql = `SELECT * FROM ${this.tableName} WHERE parent_block_id IS NOT NULL ORDER BY created_at ASC, split_index ASC LIMIT ?`;
      } else {
        sql = `SELECT * FROM ${this.tableName} WHERE parent_block_id = ? ORDER BY created_at ASC, split_index ASC LIMIT ?`;
        params.push(parentBlockId);
      }
      params.push(limit);
    } else {
      sql = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);
    }

    return this.query(sql, params);
  }

  /**
   * 根据日期范围查询 Block 列表
   * 按 created_at ASC 排序
   * @param startDate 起始日期（ISO 8601 字符串）
   * @param endDate 结束日期（ISO 8601 字符串）
   * @param status 可选的 block 状态过滤
   *   - undefined：查询所有 block
   *   - 具体状态：查询指定状态的 block
   */
  findByDateRange(
    startDate: string,
    endDate: string,
    status?: BlockStatus,
  ): Block[] {
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
   * 按时间衰减分数排序获取 Block 列表
   * @param limit 返回结果数量限制
   */
  getBlocksWithTemporalScore(limit: number = 50): Block[] {
    const sql = `SELECT * FROM ${this.tableName} ORDER BY temporal_score DESC LIMIT ?`;
    return this.query(sql, [limit]);
  }

  /**
   * 设置 Block 的字数
   * @param id Block ID
   * @param count 字数
   */
  setWordCount(id: string, count: number): number {
    const sql = `UPDATE ${this.tableName} SET word_count = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([count, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 更新 Block 的时间衰减分数
   * @param id Block ID
   * @param score 时间衰减分数
   */
  updateTemporalScore(id: string, score: number): number {
    const sql = `UPDATE ${this.tableName} SET temporal_score = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([score, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 设置单个 Block 的归档状态（独立方法，不注册 IPC）
   * @param id Block ID
   * @param isArchived 是否归档 (0 | 1)
   */
  setArchived(id: BlockId, isArchived: BooleanFlag): number {
    if (!id || id.trim() === "") return 0;
    const safeValue: number = isArchived ? 1 : 0;
    const sql = `UPDATE ${this.tableName} SET is_archived = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([safeValue, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 批量设置 Block 的归档状态（独立方法，不注册 IPC）
   * 在事务中执行，确保原子性
   * @param ids Block ID 数组
   * @param isArchived 是否归档 (0 | 1)
   * @returns 实际受影响的行数
   */
  setArchivedBatch(ids: BlockId[], isArchived: BooleanFlag): number {
    if (!ids || ids.length === 0) return 0;
    const safeValue: number = isArchived ? 1 : 0;
    return this.transaction(() => {
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `UPDATE ${this.tableName} SET is_archived = ?, updated_at = ? WHERE id IN (${placeholders})`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run([safeValue, this.getCurrentTimestamp(), ...ids]);
      return result.changes;
    });
  }

  /**
   * 根据指定字段统计 Block 数量
   * @param field 统计字段 (source | content_type)
   * @param value 字段值
   */
  countBy(field: CountByField, value: CaptureSource | ContentType): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`;
    const result = this.queryOne(sql, [value]) as unknown as { count: number };
    return result?.count || 0;
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: BlockQuery): {
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
    if (conditions.parent_block_id !== undefined) {
      if (conditions.parent_block_id === null) {
        conditionsArray.push("parent_block_id IS NULL");
      } else {
        conditionsArray.push("parent_block_id = ?");
        values.push(conditions.parent_block_id);
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
