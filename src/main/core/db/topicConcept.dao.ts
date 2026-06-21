import { BaseDao } from './base.dao'
import {
  TopicConcept,
  TopicConceptCreate,
  TopicConceptUpdate,
  TopicConceptQuery,
  Id
} from '@/main/types/db'

type FindByField = 'topic_id' | 'concept_id'
type DeleteByField = 'topic_id' | 'concept_id'
type CountByField = 'topic_id' | 'concept_id'

export class TopicConceptDao extends BaseDao<TopicConcept, TopicConceptCreate, TopicConceptUpdate> {
  constructor() {
    super('topic_concepts')
  }

  /**
   * 根据指定字段查询主题概念关联列表
   * @param field 查询字段 (topic_id | concept_id)
   * @param value 字段值
   */
  findBy(field: FindByField, value: Id): TopicConcept[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY relevance_score DESC`
    return this.query(sql, [value])
  }

  /**
   * 检查主题概念关联是否存在
   * @param topicId 主题 ID
   * @param conceptId 概念 ID
   */
  existsByTopicAndConcept(topicId: Id, conceptId: Id): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE topic_id = ? AND concept_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([topicId, conceptId]) as unknown as { exists: number }
    return result?.exists === 1
  }

  /**
   * 删除主题概念关联
   * @param field 删除字段 (topic_id | concept_id)
   * @param value1 第一个字段值
   * @param value2 第二个字段值（当 field 为 topic_id 且需要指定 concept_id 时使用）
   */
  deleteBy(field: DeleteByField, value1: Id, value2?: Id): number {
    let sql: string
    let params: unknown[]

    if (field === 'topic_id' && value2) {
      sql = `DELETE FROM ${this.tableName} WHERE topic_id = ? AND concept_id = ?`
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
   * @param topicId 主题 ID
   * @param conceptId 概念 ID
   * @param score 相关度分数
   */
  updateRelevanceScore(topicId: Id, conceptId: Id, score: number): number {
    const sql = `UPDATE ${this.tableName} SET relevance_score = ?, updated_at = ? WHERE topic_id = ? AND concept_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([score, this.getCurrentTimestamp(), topicId, conceptId])
    return result.changes
  }

  /**
   * 批量添加概念到主题
   * @param topicId 主题 ID
   * @param conceptIds 概念 ID 列表
   * @param relevanceScores 相关度分数列表（可选）
   */
  addConceptsToTopic(topicId: Id, conceptIds: Id[], relevanceScores?: number[]): void {
    this.transaction(() => {
      const timestamp = this.getCurrentTimestamp()
      for (let i = 0; i < conceptIds.length; i++) {
        const conceptId = conceptIds[i]
        if (!this.existsByTopicAndConcept(topicId, conceptId)) {
          const relevanceScore = relevanceScores?.[i] || 0.0
          this.db.prepare(`
            INSERT INTO ${this.tableName} (topic_id, concept_id, relevance_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run([topicId, conceptId, relevanceScore, timestamp, timestamp])
        }
      }
    })
  }

  /**
   * 从主题批量移除概念
   * @param topicId 主题 ID
   * @param conceptIds 概念 ID 列表
   */
  removeConceptsFromTopic(topicId: Id, conceptIds: Id[]): void {
    this.transaction(() => {
      for (const conceptId of conceptIds) {
        this.deleteBy('topic_id', topicId, conceptId)
      }
    })
  }

  /**
   * 根据指定字段统计主题概念关联数量
   * @param field 统计字段 (topic_id | concept_id)
   * @param value 字段值
   */
  countBy(field: CountByField, value: Id): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 获取主题的平均相关度分数
   * @param topicId 主题 ID
   */
  getAverageRelevance(topicId: Id): number {
    const sql = `SELECT AVG(relevance_score) as avg_score FROM ${this.tableName} WHERE topic_id = ?`
    const result = this.queryOne(sql, [topicId]) as unknown as { avg_score: number }
    return result?.avg_score || 0.0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: TopicConceptQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.topic_id !== undefined) {
      conditionsArray.push('topic_id = ?')
      values.push(conditions.topic_id)
    }
    if (conditions.concept_id !== undefined) {
      conditionsArray.push('concept_id = ?')
      values.push(conditions.concept_id)
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

export const topicConceptDao = new TopicConceptDao()
