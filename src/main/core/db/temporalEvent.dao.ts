import { BaseDao } from './base.dao'
import {
  TemporalEvent,
  TemporalEventCreate,
  TemporalEventUpdate,
  TemporalEventQuery,
  EventType,
  TemporalEventWithBlock
} from '@/main/types/db'

type FindByField = 'chunk_id' | 'event_type'
type CountByField = 'chunk_id' | 'event_type'

export class TemporalEventDao extends BaseDao<TemporalEvent, TemporalEventCreate, TemporalEventUpdate> {
  constructor() {
    super('temporal_events')
  }

  /**
   * 根据指定字段查询时间事件列表
   * @param field 查询字段 (chunk_id | event_type)
   * @param value 字段值
   */
  findBy(field: FindByField, value: string | EventType): TemporalEvent[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY created_at DESC`
    return this.query(sql, [value])
  }

  /**
   * 获取时间事件及其关联的 chunk 内容
   * @param chunkId chunk ID
   */
  findWithChunk(chunkId: string): TemporalEventWithBlock[] {
    const sql = `
      SELECT te.*, c.content AS chunk_content
      FROM ${this.tableName} te
      JOIN semantic_chunks c ON te.chunk_id = c.id
      WHERE te.chunk_id = ?
      ORDER BY te.created_at DESC
    `
    return this.query(sql, [chunkId]) as TemporalEventWithBlock[]
  }

  /**
   * 根据时间衰减分数范围查询事件列表
   * @param minScore 最低分数
   * @param maxScore 最高分数
   */
  findByTemporalScoreRange(minScore: number, maxScore: number): TemporalEvent[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE temporal_score >= ? AND temporal_score <= ? ORDER BY temporal_score DESC`
    return this.query(sql, [minScore, maxScore])
  }

  /**
   * 获取最近的时间事件列表
   * @param limit 返回结果数量限制
   */
  getRecentEvents(limit: number = 50): TemporalEvent[] {
    const sql = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT ?`
    return this.query(sql, [limit])
  }

  /**
   * 根据 chunk ID 删除所有关联的时间事件
   * @param chunkId chunk ID
   */
  deleteByChunkId(chunkId: string): number {
    const sql = `DELETE FROM ${this.tableName} WHERE chunk_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run(chunkId)
    return result.changes
  }

  /**
   * 更新时间衰减分数
   * @param id 时间事件 ID
   * @param score 时间衰减分数
   */
  updateTemporalScore(id: string, score: number): number {
    const sql = `UPDATE ${this.tableName} SET temporal_score = ?, updated_at = ? WHERE id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([score, this.getCurrentTimestamp(), id])
    return result.changes
  }

  /**
   * 根据指定字段统计时间事件数量
   * @param field 统计字段 (block_id | event_type)
   * @param value 字段值
   */
  countBy(field: CountByField, value: string | EventType): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: TemporalEventQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.chunk_id !== undefined) {
      conditionsArray.push('chunk_id = ?')
      values.push(conditions.chunk_id)
    }
    if (conditions.event_type !== undefined) {
      conditionsArray.push('event_type = ?')
      values.push(conditions.event_type)
    }
    if (conditions.temporal_score_min !== undefined) {
      conditionsArray.push('temporal_score >= ?')
      values.push(conditions.temporal_score_min)
    }
    if (conditions.temporal_score_max !== undefined) {
      conditionsArray.push('temporal_score <= ?')
      values.push(conditions.temporal_score_max)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}
