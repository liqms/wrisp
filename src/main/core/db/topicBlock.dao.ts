import { BaseDao } from './base.dao'
import {
  TopicBlock,
  TopicBlockCreate,
  TopicBlockUpdate,
  TopicBlockQuery,
  Id
} from '@/main/types/db'

type FindByField = 'topic_id' | 'block_id'
type DeleteByField = 'topic_id' | 'block_id'
type CountByField = 'topic_id' | 'block_id'

export class TopicBlockDao extends BaseDao<TopicBlock, TopicBlockCreate, TopicBlockUpdate> {
  constructor() {
    super('topic_blocks')
  }

  /**
   * 根据指定字段查询主题块关联列表
   * @param field 查询字段 (topic_id | block_id)
   * @param value 字段值
   */
  findBy(field: FindByField, value: Id): TopicBlock[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY relevance_score DESC`
    return this.query(sql, [value])
  }

  /**
   * 检查主题块关联是否存在
   * @param topicId 主题 ID
   * @param blockId 块 ID
   */
  existsByTopicAndBlock(topicId: Id, blockId: Id): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE topic_id = ? AND block_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([topicId, blockId]) as unknown as { exists: number }
    return result?.exists === 1
  }

  /**
   * 删除主题块关联
   * @param field 删除字段 (topic_id | block_id)
   * @param value1 第一个字段值
   * @param value2 第二个字段值（当 field 为 topic_id 且需要指定 block_id 时使用）
   */
  deleteBy(field: DeleteByField, value1: Id, value2?: Id): number {
    let sql: string
    let params: unknown[]

    if (field === 'topic_id' && value2) {
      sql = `DELETE FROM ${this.tableName} WHERE topic_id = ? AND block_id = ?`
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
   * @param blockId 块 ID
   * @param score 相关度分数
   */
  updateRelevanceScore(topicId: Id, blockId: Id, score: number): number {
    const sql = `UPDATE ${this.tableName} SET relevance_score = ?, updated_at = ? WHERE topic_id = ? AND block_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([score, this.getCurrentTimestamp(), topicId, blockId])
    return result.changes
  }

  /**
   * 批量添加块到主题
   * @param topicId 主题 ID
   * @param blockIds 块 ID 列表
   * @param relevanceScores 相关度分数列表（可选）
   */
  addBlocksToTopic(topicId: Id, blockIds: Id[], relevanceScores?: number[]): void {
    this.transaction(() => {
      const timestamp = this.getCurrentTimestamp()
      for (let i = 0; i < blockIds.length; i++) {
        const blockId = blockIds[i]
        if (!this.existsByTopicAndBlock(topicId, blockId)) {
          const relevanceScore = relevanceScores?.[i] || 0.0
          this.db.prepare(`
            INSERT INTO ${this.tableName} (topic_id, block_id, relevance_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run([topicId, blockId, relevanceScore, timestamp, timestamp])
        }
      }
    })
  }

  /**
   * 从主题批量移除块
   * @param topicId 主题 ID
   * @param blockIds 块 ID 列表
   */
  removeBlocksFromTopic(topicId: Id, blockIds: Id[]): void {
    this.transaction(() => {
      for (const blockId of blockIds) {
        this.deleteBy('topic_id', topicId, blockId)
      }
    })
  }

  /**
   * 根据指定字段统计主题块关联数量
   * @param field 统计字段 (topic_id | block_id)
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
  protected buildWhereClause(conditions: TopicBlockQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.topic_id !== undefined) {
      conditionsArray.push('topic_id = ?')
      values.push(conditions.topic_id)
    }
    if (conditions.block_id !== undefined) {
      conditionsArray.push('block_id = ?')
      values.push(conditions.block_id)
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
