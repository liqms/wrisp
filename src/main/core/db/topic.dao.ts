import { BaseDao } from './base.dao'
import {
  Topic,
  TopicCreate,
  TopicUpdate,
  TopicQuery,
  TopicStatus,
  TopicId,
  Name,
  TopicWithDetails,
  Id
} from '@/main/types/db'

export class TopicDao extends BaseDao<Topic, TopicCreate, TopicUpdate> {
  constructor() {
    super('topics')
  }

  /**
   * 根据状态查询主题列表
   * @param status 主题状态
   * @param orderBy 排序字段（created_at | updated_at）
   */
  findByStatus(status: TopicStatus, orderBy: 'created_at' | 'updated_at' = 'created_at'): Topic[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = ? ORDER BY ${orderBy} DESC`
    return this.query(sql, [status])
  }

  /**
   * 根据标题查询主题
   * @param title 主题标题
   */
  findByTitle(title: Name): Topic | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE title = ?`
    return this.queryOne(sql, [title])
  }

  /**
   * 根据标题模糊查询主题列表
   * @param title 标题关键词
   */
  findByTitleLike(title: string): Topic[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE title LIKE ? ORDER BY title ASC`
    return this.query(sql, [`%${title}%`])
  }

  /**
   * 获取主题及其详细信息（块数量、概念数量）
   * @param id 主题 ID
   */
  findWithDetails(id: TopicId): TopicWithDetails | null {
    const sql = `
      SELECT t.*,
             COALESCE(tb.block_count, 0) as block_count,
             COALESCE(tc.concept_count, 0) as concept_count,
             json_group_array(b.content) as blocks_preview
      FROM ${this.tableName} t
      LEFT JOIN (
        SELECT topic_id, COUNT(*) as block_count
        FROM topic_blocks
        WHERE topic_id = ?
        GROUP BY topic_id
      ) tb ON t.id = tb.topic_id
      LEFT JOIN (
        SELECT topic_id, COUNT(*) as concept_count
        FROM topic_concepts
        WHERE topic_id = ?
        GROUP BY topic_id
      ) tc ON t.id = tc.topic_id
      LEFT JOIN topic_blocks tb2 ON t.id = tb2.topic_id
      LEFT JOIN blocks b ON tb2.block_id = b.id
      WHERE t.id = ?
      GROUP BY t.id
    `
    return this.queryOne(sql, [id, id, id]) as TopicWithDetails | null
  }

  /**
   * 更新主题状态
   * @param id 主题 ID
   * @param status 新状态
   */
  updateStatus(id: string, status: TopicStatus): number {
    const sql = `UPDATE ${this.tableName} SET status = ?, updated_at = ? WHERE id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([status, this.getCurrentTimestamp(), id])
    return result.changes
  }

  /**
   * 根据关联的 Block ID 查询主题列表
   * @param blockId Block ID
   */
  findByLinkedBlock(blockId: Id): Topic[] {
    const sql = `
      SELECT t.* 
      FROM ${this.tableName} t
      JOIN topic_blocks tb ON t.id = tb.topic_id
      WHERE tb.block_id = ?
      ORDER BY tb.relevance_score DESC
    `
    return this.query(sql, [blockId])
  }

  /**
   * 根据关联的概念 ID 查询主题列表
   * @param conceptId 概念 ID
   */
  findByLinkedConcept(conceptId: Id): Topic[] {
    const sql = `
      SELECT t.* 
      FROM ${this.tableName} t
      JOIN topic_concepts tc ON t.id = tc.topic_id
      WHERE tc.concept_id = ?
      ORDER BY tc.relevance_score DESC
    `
    return this.query(sql, [conceptId])
  }

  /**
   * 根据状态统计主题数量
   * @param status 主题状态
   */
  countByStatus(status: TopicStatus): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = ?`
    const result = this.queryOne(sql, [status]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 检查标题是否已存在
   * @param title 主题标题
   * @param excludeId 排除的主题 ID（用于更新时检查）
   */
  checkTitleExists(title: Name, excludeId?: TopicId): boolean {
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
  protected buildWhereClause(conditions: TopicQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.status !== undefined) {
      conditionsArray.push('status = ?')
      values.push(conditions.status)
    }
    if (conditions.title !== undefined) {
      conditionsArray.push('title = ?')
      values.push(conditions.title)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}
