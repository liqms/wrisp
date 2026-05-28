import { BaseDao } from './base.dao'
import {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectType,
  ProjectId,
  Name,
  ProjectWithStats
} from '@/main/types/db'

export class ProjectDao extends BaseDao<Project, ProjectCreate, ProjectUpdate> {
  constructor() {
    super('projects')
  }

  /**
   * 根据名称查询项目
   * @param name 项目名称
   */
  findByName(name: Name): Project | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE name = ?`
    return this.queryOne(sql, [name])
  }

  /**
   * 根据类型查询项目列表
   * @param type 项目类型
   */
  findByType(type: ProjectType): Project[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE type = ? ORDER BY created_at DESC`
    return this.query(sql, [type])
  }

  /**
   * 根据名称模糊查询项目列表
   * @param name 名称关键词
   */
  findByNameLike(name: string): Project[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? ORDER BY name ASC`
    return this.query(sql, [`%${name}%`])
  }

  /**
   * 获取项目及其统计信息
   * @param id 项目 ID
   */
  findWithStats(id: string): ProjectWithStats | null {
    const sql = `
      SELECT p.*,
             COALESCE(pb.block_count, 0) as block_count,
             COALESCE(pp.page_count, 0) as page_count
      FROM ${this.tableName} p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as block_count
        FROM project_blocks
        WHERE project_id = ?
      ) pb ON p.id = pb.project_id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as page_count
        FROM pages
        WHERE project_id = ? AND status = 'active'
      ) pp ON p.id = pp.project_id
      WHERE p.id = ?
    `
    return this.queryOne(sql, [id, id, id]) as ProjectWithStats | null
  }

  /**
   * 获取所有项目及其统计信息
   */
  getAllWithStats(): ProjectWithStats[] {
    const sql = `
      SELECT p.*,
             COALESCE(pb.block_count, 0) as block_count,
             COALESCE(pp.page_count, 0) as page_count
      FROM ${this.tableName} p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as block_count
        FROM project_blocks
        GROUP BY project_id
      ) pb ON p.id = pb.project_id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as page_count
        FROM pages
        WHERE status = 'active'
        GROUP BY project_id
      ) pp ON p.id = pp.project_id
      ORDER BY p.created_at DESC
    `
    return this.query(sql) as unknown as ProjectWithStats[]
  }

  /**
   * 检查名称是否已存在
   * @param name 项目名称
   * @param excludeId 排除的项目 ID（用于更新时检查）
   */
  checkNameExists(name: Name, excludeId?: ProjectId): boolean {
    let sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE name = ?`
    const params: unknown[] = [name]

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
  protected buildWhereClause(conditions: ProjectQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.name !== undefined) {
      conditionsArray.push('name = ?')
      values.push(conditions.name)
    }
    if (conditions.type !== undefined) {
      conditionsArray.push('type = ?')
      values.push(conditions.type)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}
