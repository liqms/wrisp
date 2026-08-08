import { BaseDao } from './base.dao'
import {
  ConceptChunk,
  ConceptChunkCreate,
  ConceptChunkUpdate,
  ConceptChunkQuery,
  Id
} from '@/main/types/db'

type FindByField = 'concept_id' | 'chunk_id'
type DeleteByField = 'concept_id' | 'chunk_id'
type CountByField = 'concept_id' | 'chunk_id'

export class ConceptChunkDao extends BaseDao<ConceptChunk, ConceptChunkCreate, ConceptChunkUpdate> {
  constructor() {
    super('concept_blocks')
  }

  /**
   * 根据指定字段查询概念块关联列表
   * @param field 查询字段 (concept_id | chunk_id)
   * @param value 字段值
   */
  findBy(field: FindByField, value: Id): ConceptChunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY relevance_score DESC`
    return this.query(sql, [value])
  }

  /**
   * 检查概念块关联是否存在
   * @param conceptId 概念 ID
   * @param chunkId 块 ID
   */
  existsByConceptAndChunk(conceptId: Id, chunkId: Id): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE concept_id = ? AND chunk_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([conceptId, chunkId]) as unknown as { exists: number }
    return result?.exists === 1
  }

  /**
   * 删除概念块关联
   * @param field 删除字段 (concept_id | chunk_id)
   * @param value1 第一个字段值
   * @param value2 第二个字段值（当 field 为 concept_id 且需要指定 chunk_id 时使用）
   */
  deleteBy(field: DeleteByField, value1: Id, value2?: Id): number {
    let sql: string
    let params: unknown[]

    if (field === 'concept_id' && value2) {
      sql = `DELETE FROM ${this.tableName} WHERE concept_id = ? AND chunk_id = ?`
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
   * @param conceptId 概念 ID
   * @param chunkId 块 ID
   * @param score 相关度分数
   */
  updateRelevanceScore(conceptId: Id, chunkId: Id, score: number): number {
    const sql = `UPDATE ${this.tableName} SET relevance_score = ?, updated_at = ? WHERE concept_id = ? AND chunk_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([score, this.getCurrentTimestamp(), conceptId, chunkId])
    return result.changes
  }

  /**
   * 批量添加块到概念
   * @param conceptId 概念 ID
   * @param chunkIds 块 ID 列表
   * @param relevanceScores 相关度分数列表（可选）
   */
  addChunksToConcept(conceptId: Id, chunkIds: Id[], relevanceScores?: number[]): void {
    this.transaction(() => {
      const timestamp = this.getCurrentTimestamp()
      for (let i = 0; i < chunkIds.length; i++) {
        const chunkId = chunkIds[i]
        if (!this.existsByConceptAndChunk(conceptId, chunkId)) {
          const relevanceScore = relevanceScores?.[i] || 0.0
          this.db.prepare(`
            INSERT INTO ${this.tableName} (concept_id, chunk_id, relevance_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run([conceptId, chunkId, relevanceScore, timestamp, timestamp])
        }
      }
    })
  }

  /**
   * 从概念批量移除块
   * @param conceptId 概念 ID
   * @param chunkIds 块 ID 列表
   */
  removeChunksFromConcept(conceptId: Id, chunkIds: Id[]): void {
    this.transaction(() => {
      for (const chunkId of chunkIds) {
        this.deleteBy('concept_id', conceptId, chunkId)
      }
    })
  }

  /**
   * 根据指定字段统计概念块关联数量
   * @param field 统计字段 (concept_id | chunk_id)
   * @param value 字段值
   */
  countBy(field: CountByField, value: Id): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 获取概念的平均相关度分数
   * @param conceptId 概念 ID
   */
  getAverageRelevance(conceptId: Id): number {
    const sql = `SELECT AVG(relevance_score) as avg_score FROM ${this.tableName} WHERE concept_id = ?`
    const result = this.queryOne(sql, [conceptId]) as unknown as { avg_score: number }
    return result?.avg_score || 0.0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ConceptChunkQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.concept_id !== undefined) {
      conditionsArray.push('concept_id = ?')
      values.push(conditions.concept_id)
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

export const conceptChunkDao = new ConceptChunkDao()