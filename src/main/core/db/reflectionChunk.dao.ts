import { BaseDao } from './base.dao'
import {
  ReflectionChunk,
  ReflectionChunkCreate,
  ReflectionChunkUpdate,
  ReflectionChunkQuery,
  Id
} from '@/main/types/db'

type FindByField = 'reflection_id' | 'chunk_id'
type DeleteByField = 'reflection_id' | 'chunk_id'
type CountByField = 'reflection_id' | 'chunk_id'

export class ReflectionChunkDao extends BaseDao<ReflectionChunk, ReflectionChunkCreate, ReflectionChunkUpdate> {
  constructor() {
    super('reflection_chunks')
  }

  /**
   * 根据指定字段查询反思块关联列表
   * @param field 查询字段 (reflection_id | chunk_id)
   * @param value 字段值
   */
  findBy(field: FindByField, value: Id): ReflectionChunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY relevance_score DESC`
    return this.query(sql, [value])
  }

  /**
   * 检查反思块关联是否存在
   * @param reflectionId 反思 ID
   * @param chunkId 块 ID
   */
  existsByReflectionAndChunk(reflectionId: Id, chunkId: Id): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE reflection_id = ? AND chunk_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([reflectionId, chunkId]) as unknown as { exists: number }
    return result?.exists === 1
  }

  /**
   * 删除反思块关联
   * @param field 删除字段 (reflection_id | chunk_id)
   * @param value1 第一个字段值
   * @param value2 第二个字段值（当 field 为 reflection_id 且需要指定 chunk_id 时使用）
   */
  deleteBy(field: DeleteByField, value1: Id, value2?: Id): number {
    let sql: string
    let params: unknown[]

    if (field === 'reflection_id' && value2) {
      sql = `DELETE FROM ${this.tableName} WHERE reflection_id = ? AND chunk_id = ?`
      params = [value1, value2]
    } else {
      sql = `DELETE FROM ${this.tableName} WHERE ${field} = ?`
      params = [value1]
    }

    const stmt = this.db.prepare(sql)
    const result = stmt.run(params)
    return result.changes
  }

  /**
   * 更新相关度分数
   * @param reflectionId 反思 ID
   * @param chunkId 块 ID
   * @param score 相关度分数
   */
  updateRelevanceScore(reflectionId: Id, chunkId: Id, score: number): number {
    const sql = `UPDATE ${this.tableName} SET relevance_score = ?, updated_at = ? WHERE reflection_id = ? AND chunk_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([score, this.getCurrentTimestamp(), reflectionId, chunkId])
    return result.changes
  }

  /**
   * 批量添加块到反思
   * @param reflectionId 反思 ID
   * @param chunkIds 块 ID 列表
   * @param relevanceScores 相关度分数列表（可选）
   */
  addChunksToReflection(reflectionId: Id, chunkIds: Id[], relevanceScores?: number[]): void {
    this.transaction(() => {
      const timestamp = this.getCurrentTimestamp()
      for (let i = 0; i < chunkIds.length; i++) {
        const chunkId = chunkIds[i]
        if (!this.existsByReflectionAndChunk(reflectionId, chunkId)) {
          const relevanceScore = relevanceScores?.[i] || 0.0
          this.db.prepare(`
            INSERT INTO ${this.tableName} (reflection_id, chunk_id, relevance_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run([reflectionId, chunkId, relevanceScore, timestamp, timestamp])
        }
      }
    })
  }

  /**
   * 从反思批量移除块
   * @param reflectionId 反思 ID
   * @param chunkIds 块 ID 列表
   */
  removeChunksFromReflection(reflectionId: Id, chunkIds: Id[]): void {
    this.transaction(() => {
      for (const chunkId of chunkIds) {
        this.deleteBy('reflection_id', reflectionId, chunkId)
      }
    })
  }

  /**
   * 根据指定字段统计反思块关联数量
   * @param field 统计字段 (reflection_id | chunk_id)
   * @param value 字段值
   */
  countBy(field: CountByField, value: Id): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 获取反思的平均相关度分数
   * @param reflectionId 反思 ID
   */
  getAverageRelevance(reflectionId: Id): number {
    const sql = `SELECT AVG(relevance_score) as avg_score FROM ${this.tableName} WHERE reflection_id = ?`
    const result = this.queryOne(sql, [reflectionId]) as unknown as { avg_score: number }
    return result?.avg_score || 0.0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ReflectionChunkQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.reflection_id !== undefined) {
      conditionsArray.push('reflection_id = ?')
      values.push(conditions.reflection_id)
    }
    if (conditions.chunk_id !== undefined) {
      conditionsArray.push('chunk_id = ?')
      values.push(conditions.chunk_id)
    }
    if (conditions.relevance_score_min !== undefined) {
      conditionsArray.push('relevance_score >= ?')
      values.push(conditions.relevance_score_min)
    }
    if (conditions.relevance_score_max !== undefined) {
      conditionsArray.push('relevance_score <= ?')
      values.push(conditions.relevance_score_max)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}