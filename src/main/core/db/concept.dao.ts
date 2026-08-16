import { BaseDao } from './base.dao'
import {
  Concept,
  ConceptCreate,
  ConceptUpdate,
  ConceptQuery,
  ConceptId,
  Name,
  ConceptWithBlocks,
  Id
} from '@/main/types/db'

export class ConceptDao extends BaseDao<Concept, ConceptCreate, ConceptUpdate> {
  constructor() {
    super('concepts')
  }

  /**
   * 根据标题查询概念
   * @param title 概念标题
   */
  findByTitle(title: Name): Concept | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE title = ?`
    return this.queryOne(sql, [title])
  }

  /**
   * 根据标题模糊查询概念列表
   * @param title 标题关键词
   */
  findByTitleLike(title: string): Concept[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE title LIKE ? ORDER BY title ASC`
    return this.query(sql, [`%${title}%`])
  }

  /**
   * 根据关联度范围查询概念列表
   * @param minRelevance 最低关联度（默认 0）
   * @param maxRelevance 最高关联度（可选）
   */
  findByRelevanceRange(minRelevance: number = 0, maxRelevance?: number): Concept[] {
    let sql: string
    let params: unknown[]

    if (maxRelevance !== undefined) {
      sql = `SELECT * FROM ${this.tableName} WHERE relevance >= ? AND relevance <= ? ORDER BY relevance DESC`
      params = [minRelevance, maxRelevance]
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE relevance >= ? ORDER BY relevance DESC`
      params = [minRelevance]
    }

    return this.query(sql, params)
  }

  /**
   * 获取概念及其关联的 chunk 数量
   * @param id 概念 ID
   */
  findWithBlocks(id: ConceptId): ConceptWithBlocks | null {
    const sql = `
      SELECT c.*, 
             COALESCE(bc.block_count, 0) as block_count,
             json_group_array(sc.content) as linked_block_contents
      FROM ${this.tableName} c
      LEFT JOIN (
        SELECT concept_id, chunk_id, COUNT(*) as block_count
        FROM concept_chunks
        WHERE concept_id = ?
        GROUP BY concept_id
      ) bc ON c.id = bc.concept_id
      LEFT JOIN concept_chunks cc ON c.id = cc.concept_id
      LEFT JOIN semantic_chunks sc ON cc.chunk_id = sc.id
      WHERE c.id = ?
      GROUP BY c.id
    `
    return this.queryOne(sql, [id, id]) as ConceptWithBlocks | null
  }

  /**
   * 更新概念的关联度
   * @param id 概念 ID
   * @param relevance 关联度
   */
  updateRelevance(id: string, relevance: number): number {
    const sql = `UPDATE ${this.tableName} SET relevance = ?, updated_at = ? WHERE id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([relevance, this.getCurrentTimestamp(), id])
    return result.changes
  }

  /**
   * 根据关联的 chunk ID 查询概念列表
   * @param chunkId chunk ID
   */
  findByLinkedBlock(chunkId: Id): Concept[] {
    const sql = `
      SELECT c.* 
      FROM ${this.tableName} c
      JOIN concept_chunks cc ON c.id = cc.concept_id
      WHERE cc.chunk_id = ?
      ORDER BY cc.relevance_score DESC
    `
    return this.query(sql, [chunkId])
  }

  /**
   * 检查标题是否已存在
   * @param title 概念标题
   * @param excludeId 排除的概念 ID（用于更新时检查）
   */
  checkTitleExists(title: Name, excludeId?: ConceptId): boolean {
    let sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE title = ?`
    const params: unknown[] = [title]

    if (excludeId) {
      sql += ' AND id != ?)'
      params.push(excludeId)
    } else {
      sql += ')'
    }

    const stmt = this.db.prepare(sql)
    const result = stmt.get(params) as { exists: number }
    return result?.exists === 1
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ConceptQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.title !== undefined) {
      conditionsArray.push('title = ?')
      values.push(conditions.title)
    }
    if (conditions.relevance_min !== undefined) {
      conditionsArray.push('relevance >= ?')
      values.push(conditions.relevance_min)
    }
    if (conditions.relevance_max !== undefined) {
      conditionsArray.push('relevance <= ?')
      values.push(conditions.relevance_max)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}

export const conceptDao = new ConceptDao()
