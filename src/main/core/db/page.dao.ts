
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

/** pages_fts 索引的列：仅当这些列变化时才需要重建索引 */
const FTS_INDEXED_FIELDS = ['title', 'ai_summary'] as const

/**
 * 页面级智能任务的阶段标记列。
 * SET 子句里的列名只能取自这个联合类型（字面量联合，编译期即白名单），
 * 不接受调用方传来的任意字符串，避免 SQL 注入面。
 */
export type PageStageColumn =
  | 'last_smart_processed_at'
  | 'last_summary_generated_at'
  | 'last_vectorized_at'

export class PageDao extends BaseDao<Page, PageCreate, PageUpdate> {
  constructor() {
    super('pages')
  }

  /** 参与页面全文索引的列 */
  protected get ftsIndexedFields(): readonly string[] {
    return FTS_INDEXED_FIELDS
  }

  /**
   * 全文搜索页面（FTS5 trigram 子串匹配，中文可用）
   * 关键词 >= 3 字符时走 pages_fts 索引；不足 3 字符时回退 LIKE 子串匹配。
   * @param query 搜索关键词
   * @param limit 返回结果数量限制
   */
  searchFts(query: string, limit: number = 50): Page[] {
    const phrase = this.buildFtsPhrase(query)
    if (phrase) {
      const sql = `
        SELECT c.* FROM ${this.tableName} c
        JOIN ${this.tableName}_fts ON ${this.tableName}_fts.rowid = c.rowid
        WHERE c.status = 'active' AND ${this.tableName}_fts MATCH ?
        ORDER BY c.created_at DESC
        LIMIT ?
      `
      return this.query(sql, [phrase, limit])
    }

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'active' AND (title LIKE ? ESCAPE '\\' OR ai_summary LIKE ? ESCAPE '\\')
      ORDER BY created_at DESC
      LIMIT ?
    `
    const pattern = this.buildLikePattern(query)
    return this.query(sql, [pattern, pattern, limit])
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
   * 记录页面级智能任务的阶段完成标记（时间取当前，与 `updated_at` 同为 ISO 格式）。
   *
   * 只写标记列，**不刷新 `updated_at`**：各任务的增量选取条件正是
   * `updated_at > last_xxx_at`，若写标记本身把水位线顶到标记之后，该页会在
   * 下一轮被自己重新选中，永远收敛不了（同 ChunkDao.recordStage 的理由）。
   *
   * @param pageId 页面 id
   * @param columns 本轮完成的阶段列（重复列只取一次）
   * @returns 受影响行数
   */
  recordStage(pageId: string, columns: readonly PageStageColumn[]): number {
    if (!pageId) return 0
    const { sets, values } = this.buildStageSets(columns)
    if (sets.length === 0) return 0

    return this.execute(
      `UPDATE ${this.tableName} SET ${sets.join(', ')} WHERE id = ?`,
      [...values, pageId],
    ).changes
  }

  /**
   * {@link recordStage} 的批量版本：一批页面只发一条 UPDATE。
   * 页面向量化按批写标记，逐页写即每页一条 SQL。
   */
  recordStageBatch(
    pageIds: readonly string[],
    columns: readonly PageStageColumn[],
  ): number {
    if (pageIds.length === 0) return 0
    const { sets, values } = this.buildStageSets(columns)
    if (sets.length === 0) return 0

    const placeholders = pageIds.map(() => '?').join(', ')
    return this.execute(
      `UPDATE ${this.tableName} SET ${sets.join(', ')} WHERE id IN (${placeholders})`,
      [...values, ...pageIds],
    ).changes
  }

  /** 拼接阶段标记的 SET 子句；列名只来自 PageStageColumn 联合类型 */
  private buildStageSets(
    columns: readonly PageStageColumn[],
  ): { sets: string[]; values: unknown[] } {
    const timestamp = this.getCurrentTimestamp()
    const sets: string[] = []
    const values: unknown[] = []

    for (const column of new Set(columns)) {
      sets.push(`${column} = ?`)
      values.push(timestamp)
    }

    return { sets, values }
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

export const pageDao = new PageDao()
