import { BaseDao } from './base.dao'
import { Work, WorkCreate, WorkUpdate, WorkStatus, WorkQuery } from '@/main/types/db'
import { Logger } from '@/main/utils/logger'
import { validateString, validateId, validateFilePath } from '@/shared/utils/validate'
import { PaginationResult } from '@/shared/utils/pagination'
/**
 * 作品数据访问对象
 * 提供作品相关的数据库操作方法
 */
export class WorkDao extends BaseDao<Work, WorkCreate, WorkUpdate> {
  /**
   * 构造函数
   * 初始化作品 DAO，指定表名为 'works'
   */
  constructor() {
    super('works', {
      enabled: true,
      createdAtField: 'created_at',
      updatedAtField: 'updated_at'
    })
  }

  /**
   * 创建作品记录
   * @param data - 作品创建数据
   * @returns 新创建作品的 ID
   * @throws {Error} 当作品标题或作品类型为空时抛出错误
   */
  create(data: WorkCreate): number {
    if (!validateString(data.name, '作品名称') || !validateString(data.work_type, '作品类型') || !validateFilePath(data.path, '文件夹路径') || !validateFilePath(data.full_path, '文件夹完整路径')) {
      throw new Error('作品名称、作品类型、路径和完整路径不能为空')
    }
    const defaults: WorkCreate = {
      ...data,
      status: 1,
    }
    return super.create(defaults)
  }

  /**
   * 根据条件查询作品列表
   * @param params - 查询参数对象
   * @returns 符合条件的作品列表
   */
  findByParams(params: WorkQuery): PaginationResult<Work> {
    const queryParams = {
      page: params.page || 1,
      page_size: params.page_size || 10,
      order_by: params.order_by || 'created_at',
      order_dir: params.order_dir || 'DESC',
      conditions: {
        work_type: params.work_type,
        status: params.status,
        name: params.name,
        metadata: params.metadata
      }
    }

    return super.paginate(queryParams)
  }

  /**
   * 更新作品字段值
   * @param id - 作品ID
   * @param field - 要更新的字段名
   * @param value - 新的值
   * @param fieldName - 字段显示名称（用于错误日志）
   * @returns 是否更新成功
   */
  private updateField(id: number, field: string, value: string | number | null, fieldName: string): boolean {
    const sql = `UPDATE works SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`

    try {
      const stmt = this.db.prepare(sql)
      const result = stmt.run(value, id)
      return result.changes > 0
    } catch (error) {
      Logger.error(`更新作品${fieldName}失败:`, { error: String(error), id, [field]: value })
      throw error
    }
  }

  /**
   * 更新作品字数统计
   * @param id - 作品ID
   * @param wordCount - 新的字数统计值
   * @returns 是否更新成功
   */
  updateWordCount(id: number, wordCount: number): boolean {
    return this.updateField(id, 'word_count', wordCount, '字数统计')
  }

  /**
   * 更新作品章节统计
   * @param id - 作品ID
   * @param chapterCount - 新的章节统计值
   * @returns 是否更新成功
   */
  updateChapterCount(id: number, chapterCount: number): boolean {
    return this.updateField(id, 'chapter_count', chapterCount, '章节统计')
  }

  /**
   * 更新作品状态
   * @param id - 作品ID
   * @param status - 新的状态
   * @returns 是否更新成功
   */
  updateStatus(id: number, status: WorkStatus): boolean {
    return this.updateField(id, 'status', status, '状态')
  }

  /**
   * 批量更新作品状态
   * @param ids - 作品ID数组
   * @param status - 新的状态
   * @returns 更新的记录数量
   */
  batchUpdateStatus(ids: number[], status: WorkStatus): number {
    if (ids.length === 0) {
      return 0
    }

    const placeholders = ids.map(() => '?').join(',')
    const sql = `UPDATE works SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`

    try {
      const stmt = this.db.prepare(sql)
      const result = stmt.run(status, ...ids)
      return result.changes
    } catch (error) {
      Logger.error('批量更新作品状态失败:', { error: String(error), ids, status })
      throw error
    }
  }

  /**
   * 统一批量操作作品
   * 支持批量创建和批量更新操作
   * @param operations - 批量操作配置
   * @returns 操作结果（创建返回ID数组，更新返回影响行数）
   */
  batch(operations: {
    type: 'create' | 'update'
    data: WorkCreate[] | Array<{
      field: 'name' | 'work_type' | 'status' | 'path' | 'full_path'
      oldValue: string | number
      newValue: string | number | null
    }>
  }): number[] | number {
    if (operations.type === 'create') {
      // 批量创建作品
      const works = operations.data as WorkCreate[]
      return this.transaction(() => works.map(work => this.create(work)))
    }

    if (operations.type === 'update') {
      // 批量更新字段
      const updates = operations.data as Array<{
        field: 'name' | 'work_type' | 'status' | 'path' | 'full_path'
        oldValue: string | number
        newValue: string | number | null
      }>

      let totalChanges = 0

      for (const update of updates) {
        // 使用白名单验证字段名，防止SQL注入
        const allowedFields = ['name', 'work_type', 'status', 'path', 'full_path']
        if (!allowedFields.includes(update.field)) {
          throw new Error(`不允许的字段名: ${update.field}`)
        }

        // 验证参数
        if (update.field === 'name' || update.field === 'work_type' || update.field === 'path' || update.field === 'full_path') {
          if (!validateString(update.oldValue as string, `旧${update.field}值`)) {
            throw new Error(`${update.field}值无效`)
          }
          if (update.newValue !== null && !validateString(update.newValue as string, `新${update.field}值`)) {
            throw new Error(`新${update.field}值无效`)
          }
        } else {
          if (!validateId(update.oldValue as number, `旧${update.field}值`)) {
            throw new Error(`${update.field}值无效`)
          }
          if (update.newValue !== null && !validateId(update.newValue as number, `新${update.field}值`)) {
            throw new Error(`新${update.field}值无效`)
          }
        }

        const changes = super.execute(`UPDATE works SET ${update.field} = ? WHERE ${update.field} = ?`,
          [update.newValue, update.oldValue]).changes
        totalChanges += changes
      }

      return totalChanges
    }

    throw new Error(`不支持的批量操作类型: ${operations.type}`)
  }

}