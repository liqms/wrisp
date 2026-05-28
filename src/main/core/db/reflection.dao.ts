import { BaseDao } from './base.dao'
import {
  Reflection,
  ReflectionCreate,
  ReflectionUpdate,
  ReflectionQuery,
  ReflectionType,
  ReflectionStatus,
  Name,
  ReflectionWithBlocks,
  Id
} from '@/main/types/db'

type FindByField = 'type' | 'status'
type CountByField = 'type' | 'status'

export class ReflectionDao extends BaseDao<Reflection, ReflectionCreate, ReflectionUpdate> {
  constructor() {
    super('reflections')
  }

  /**
   * 根据指定字段查询反思列表
   * @param field 查询字段 (type | status)
   * @param value 字段值
   */
  findBy(field: FindByField, value: ReflectionType | ReflectionStatus): Reflection[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY created_at DESC`
    return this.query(sql, [value])
  }

  /**
   * 根据标题查询反思
   * @param title 反思标题
   */
  findByTitle(title: Name): Reflection | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE title = ?`
    return this.queryOne(sql, [title])
  }

  /**
   * 获取反思及其关联的块信息
   * @param id 反思 ID
   */
  findWithBlocks(id: string): ReflectionWithBlocks | null {
    const sql = `
      SELECT r.*,
             COALESCE(rb.block_count, 0) as block_count,
             json_group_array(b.content) as blocks_preview
      FROM ${this.tableName} r
      LEFT JOIN (
        SELECT reflection_id, COUNT(*) as block_count
        FROM reflection_blocks
        WHERE reflection_id = ?
        GROUP BY reflection_id
      ) rb ON r.id = rb.reflection_id
      LEFT JOIN reflection_blocks rb2 ON r.id = rb2.reflection_id
      LEFT JOIN blocks b ON rb2.block_id = b.id
      WHERE r.id = ?
      GROUP BY r.id
    `
    return this.queryOne(sql, [id, id]) as ReflectionWithBlocks | null
  }

  /**
   * 根据关联的 Block ID 查询反思列表
   * @param blockId Block ID
   */
  findByLinkedBlock(blockId: Id): Reflection[] {
    const sql = `
      SELECT r.* 
      FROM ${this.tableName} r
      JOIN reflection_blocks rb ON r.id = rb.reflection_id
      WHERE rb.block_id = ?
      ORDER BY rb.relevance_score DESC
    `
    return this.query(sql, [blockId])
  }

  /**
   * 获取待处理的反思列表
   */
  getPendingReflections(): Reflection[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'pending' ORDER BY created_at DESC`
    return this.query(sql)
  }

  /**
   * 更新反思状态
   * @param id 反思 ID
   * @param status 新状态
   */
  updateStatus(id: string, status: ReflectionStatus): number {
    const sql = `UPDATE ${this.tableName} SET status = ?, updated_at = ? WHERE id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([status, this.getCurrentTimestamp(), id])
    return result.changes
  }

  /**
   * 根据指定字段统计反思数量
   * @param field 统计字段 (type | status)
   * @param value 字段值
   */
  countBy(field: CountByField, value: ReflectionType | ReflectionStatus): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ReflectionQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.type !== undefined) {
      conditionsArray.push('type = ?')
      values.push(conditions.type)
    }
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
