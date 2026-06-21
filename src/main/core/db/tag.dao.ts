import { BaseDao } from './base.dao'
import {
  Tag,
  TagCreate,
  TagUpdate,
  TagId,
  TagDetail,
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
   * @param name 名称关键词（自动转义 LIKE 通配符）
   * @param limit 最大返回条数（默认 50）
   */
  findByNameLike(name: string, limit: number = 50): Tag[] {
    // 转义 LIKE 通配符 %、_ 及反斜杠
    const escaped = name.replace(/[\\%_]/g, '\\$&')
    const sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT ?`
    return this.query(sql, [`%${escaped}%`, limit])
  }

  /**
   * 获取标签及其使用次数
   * @param entityType 实体类型过滤（可选）
   */
  getAllDetail(entityType?: string): TagDetail[] {
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
        ORDER BY usage_count DESC, created_at DESC
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

    return this.query(sql, params) as TagDetail[]
  }

  /**
   * 检查名称是否已存在
   * @param name 标签名称
   * @param excludeId 排除的标签 ID（用于更新时检查）
   */
  checkNameExists(name: Name, excludeId?: TagId): boolean {
    let sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE name = ?`
    const params: unknown[] = [name]

    if (excludeId != null) {
      sql += ' AND id != ?)'
      params.push(excludeId)
    } else {
      sql += ')'
    }

    // 为结果列添加别名，确保在不同 SQLite 版本中可以稳定读取列名
    sql += ' AS "exists"'

    const stmt = this.db.prepare(sql)
    const result = stmt.get(params) as unknown as { exists?: number }
    return result?.exists === 1
  }

  /**
   * 根据 ID 查询标签详情（含使用次数）
   * @param id 标签 ID
   */
  getDetailById(id: TagId): TagDetail | null {
    const sql = `
      SELECT t.*, COALESCE(ti.count, 0) as usage_count
      FROM ${this.tableName} t
      LEFT JOIN (
        SELECT tag_id, COUNT(*) as count
        FROM tagged_items
        GROUP BY tag_id
      ) ti ON t.id = ti.tag_id
      WHERE t.id = ?
    `
    return this.queryOne(sql, [id]) as TagDetail | null
  }
}

