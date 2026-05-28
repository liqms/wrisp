import { BaseDao } from './base.dao'
import {
  Tag,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagId,
  TagWithCount,
  Name
} from '@/main/types/db'

export class TagDao extends BaseDao<Tag, TagCreate, TagUpdate> {
  constructor() {
    super('tags')
  }

  /**
   * 根据名称查询标签
   * @param name 标签名称
   */
  findByName(name: Name): Tag | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE name = ?`
    return this.queryOne(sql, [name])
  }

  /**
   * 根据名称模糊查询标签列表
   * @param name 名称关键词
   */
  findByNameLike(name: string): Tag[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? ORDER BY name ASC`
    return this.query(sql, [`%${name}%`])
  }

  /**
   * 根据颜色查询标签列表
   * @param color 标签颜色
   */
  findByColor(color: string): Tag[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE color = ? ORDER BY name ASC`
    return this.query(sql, [color])
  }

  /**
   * 获取标签及其使用次数
   * @param entityType 实体类型过滤（可选）
   */
  getAllWithCount(entityType?: string): TagWithCount[] {
    let sql: string
    let params: unknown[] = []

    if (entityType) {
      sql = `
        SELECT t.*, COALESCE(ti.count, 0) as usage_count
        FROM ${this.tableName} t
        LEFT JOIN (
          SELECT tag_id, COUNT(*) as count
          FROM tagged_items
          WHERE entity_type = ?
          GROUP BY tag_id
        ) ti ON t.id = ti.tag_id
        ORDER BY usage_count DESC
      `
      params = [entityType]
    } else {
      sql = `
        SELECT t.*, COALESCE(ti.count, 0) as usage_count
        FROM ${this.tableName} t
        LEFT JOIN (
          SELECT tag_id, COUNT(*) as count
          FROM tagged_items
          GROUP BY tag_id
        ) ti ON t.id = ti.tag_id
        ORDER BY usage_count DESC, created_at DESC
      `
    }

    return this.query(sql, params) as TagWithCount[]
  }

  /**
   * 检查名称是否已存在
   * @param name 标签名称
   * @param excludeId 排除的标签 ID（用于更新时检查）
   */
  checkNameExists(name: Name, excludeId?: TagId): boolean {
    let sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE name = ?`
    const params: unknown[] = [name]

    if (excludeId) {
      sql += ' AND id != ?)'
      params.push(excludeId)
    } else {
      sql += ')'
    }

    const stmt = this.db.prepare(sql)
    const result = stmt.get(params) as unknown as { exists: number }
    return result?.exists === 1
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: TagQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.name !== undefined) {
      conditionsArray.push('name = ?')
      values.push(conditions.name)
    }
    if (conditions.color !== undefined) {
      conditionsArray.push('color = ?')
      values.push(conditions.color)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}