import { BaseDao } from './base.dao'
import {
  Page,
  PageCreate,
  PageUpdate,
  PageQuery,
  PageStatus,
  PageId,
  Name,
  PageTree
} from '@/main/types/db'

type FindByField = 'project_id' | 'parent_page_id' | 'status'
type CountByField = 'project_id' | 'parent_page_id'
type UpdateField = 'order_index' | 'status' | 'word_count'

export class PageDao extends BaseDao<Page, PageCreate, PageUpdate> {
  constructor() {
    super('pages')
  }

  /**
   * 根据指定字段查询页面列表
   * @param field 查询字段 (project_id | parent_page_id | status)
   * @param value 字段值
   */
  findBy(field: FindByField, value: string | PageStatus | PageId | null): Page[] {
    let sql: string
    let params: unknown[]

    if (value === null) {
      sql = `SELECT * FROM ${this.tableName} WHERE ${field} IS NULL ORDER BY order_index ASC`
      params = []
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY order_index ASC`
      params = [value]
    }

    if (field === 'status') {
      sql = sql.replace('ORDER BY order_index ASC', 'ORDER BY created_at DESC')
    }

    return this.query(sql, params)
  }

  /**
   * 根据标题查询页面
   * @param title 页面标题
   */
  findByTitle(title: Name): Page | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE title = ?`
    return this.queryOne(sql, [title])
  }

  /**
   * 查询容器页面或普通页面
   * @param projectId 项目 ID
   * @param isContainer 是否容器页面
   */
  findByContainerType(projectId: string, isContainer: boolean): Page[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE project_id = ? AND is_container = ? ORDER BY order_index ASC`
    return this.query(sql, [projectId, isContainer ? 1 : 0])
  }

  /**
   * 获取项目页面树
   * @param projectId 项目 ID
   */
  getPageTree(projectId: string): PageTree[] {
    const pages = this.findBy('project_id', projectId)
    return this.buildTree(pages)
  }

  /**
   * 获取最大排序索引
   * @param projectId 项目 ID
   * @param parentPageId 父页面 ID（可选）
   */
  getMaxOrderIndex(projectId: string, parentPageId: PageId | null): number {
    let sql: string
    let params: unknown[]

    if (parentPageId) {
      sql = `SELECT COALESCE(MAX(order_index), -1) as max_order FROM ${this.tableName} WHERE project_id = ? AND parent_page_id = ?`
      params = [projectId, parentPageId]
    } else {
      sql = `SELECT COALESCE(MAX(order_index), -1) as max_order FROM ${this.tableName} WHERE project_id = ? AND parent_page_id IS NULL`
      params = [projectId]
    }

    const result = this.queryOne(sql, params) as unknown as { max_order: number }
    return result?.max_order ?? -1
  }

  /**
   * 更新页面指定字段
   * @param id 页面 ID
   * @param field 更新字段 (order_index | status | word_count)
   * @param value 更新值
   */
  updateField(id: string, field: UpdateField, value: number | PageStatus): number {
    const sql = `UPDATE ${this.tableName} SET ${field} = ?, updated_at = ? WHERE id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([value, this.getCurrentTimestamp(), id])
    return result.changes
  }

  /**
   * 根据项目 ID 删除所有页面
   * @param projectId 项目 ID
   */
  deleteByProjectId(projectId: string): number {
    const sql = `DELETE FROM ${this.tableName} WHERE project_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run(projectId)
    return result.changes
  }

  /**
   * 根据指定字段统计页面数量
   * @param field 统计字段 (project_id | parent_page_id)
   * @param value 字段值
   */
  countBy(field: CountByField, value: string | PageId | null): number {
    let sql: string
    let params: unknown[]

    if (field === 'project_id' && value !== null) {
      sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE project_id = ? AND status = 'active'`
      params = [value]
    } else if (value === null) {
      sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} IS NULL`
      params = []
    } else {
      sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
      params = [value]
    }

    const result = this.queryOne(sql, params) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 构建页面树
   * @param pages 页面列表
   * @param parentId 父页面 ID
   */
  private buildTree(pages: Page[], parentId: PageId | null = null): PageTree[] {
    return pages
      .filter(page => page.parent_page_id === parentId)
      .sort((a, b) => a.order_index - b.order_index)
      .map(page => ({
        ...page,
        children: this.buildTree(pages, page.id)
      }))
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: PageQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.project_id !== undefined) {
      if (conditions.project_id === null) {
        conditionsArray.push('project_id IS NULL')
      } else {
        conditionsArray.push('project_id = ?')
        values.push(conditions.project_id)
      }
    }
    if (conditions.parent_page_id !== undefined) {
      if (conditions.parent_page_id === null) {
        conditionsArray.push('parent_page_id IS NULL')
      } else {
        conditionsArray.push('parent_page_id = ?')
        values.push(conditions.parent_page_id)
      }
    }
    if (conditions.is_container !== undefined) {
      conditionsArray.push('is_container = ?')
      values.push(conditions.is_container ? 1 : 0)
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
