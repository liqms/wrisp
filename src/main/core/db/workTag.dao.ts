import { BaseDao } from './base.dao'
import { WorkTag, WorkTagCreate, WorkTagUpdate, WorkTagQuery } from '@/main/types/db'
import { validateId, validateString } from '@/shared/utils/validate'
import { PaginationResult } from '@/shared/utils/pagination'

/**
 * 作品标签数据访问对象
 * 提供作品标签相关的数据库操作方法
 */
export class WorkTagDao extends BaseDao<WorkTag, WorkTagCreate, WorkTagUpdate> {
  /**
   * 构造函数
   * 初始化作品标签 DAO，指定表名为 'works_tags'
   */
  constructor() {
    super('works_tags', { 
      enabled: true,
      createdAtField: 'created_at',
    })
  }

  /**
   * 添加作品标签记录
   * @param data - 作品标签创建数据
   * @returns 新创建作品标签的 ID
   * @throws {Error} 当参数无效时抛出错误
   */
  create(data: WorkTagCreate): number {
    if (!validateId(data.work_id, '作品ID') || !validateString(data.tag_name, '标签名')) {
      throw new Error('作品ID和标签名不能为空')
    }

    const defaults: WorkTagCreate = {
      ...data,
      created_at: new Date().toISOString(),
    }
    return super.create(defaults)
  }

  /**
   * 统一查询作品标签列表
   * 支持多种查询条件组合
   * @param params - 查询参数对象
   * @returns 符合条件的作品标签列表分页结果
   */
  findByParams(params: WorkTagQuery): PaginationResult<WorkTag> {
    const queryParams = {
      page: params.page || 1,
      pageSize: params.page_size || 10,
      orderBy: params.order_by || 'created_at',
      orderDir: params.order_dir || 'DESC',
      conditions: {
        work_id: params.work_id,
        tag_name: params.tag_name
      }
    }
    return super.paginate(queryParams)
  }
  /**
   * 统一更新作品标签信息
   * 支持更新标签名等字段
   * @param conditions - 更新条件对象
   * @returns 受影响的行数
   * @throws {Error} 当参数无效时抛出错误
   */
  updateByField(conditions: {
    id: number
    field: 'tag_name'
    value: string
  }): number {
    if (!validateId(conditions.id, '作品标签ID')) {
      throw new Error('作品标签ID无效')
    }

    // 字段白名单验证
    const allowedFields = ['tag_name']
    if (!allowedFields.includes(conditions.field)) {
      throw new Error(`不允许的字段名: ${conditions.field}`)
    }

    // 验证新值
    if (!validateString(conditions.value, '标签名')) {
      throw new Error('标签名无效')
    }

    // 构建SQL语句
    const sql = `UPDATE works_tags SET ${conditions.field} = ? WHERE id = ?`
    
    return super.execute(sql, [conditions.value, conditions.id]).changes
  }

  /**
   * 统一批量操作作品标签
   * 支持批量创建和批量更新操作
   * @param operations - 批量操作配置
   * @returns 操作结果（创建返回ID数组，更新返回影响行数）
   */
  batch(operations: {
    type: 'create' | 'update'
    data: WorkTagCreate[] | Array<{
      field: 'work_id' | 'tag_name'
      oldValue: string | number
      newValue: string | number | null
    }>
  }): number[] | number {
    if (operations.type === 'create') {
      // 批量创建作品标签
      const tags = operations.data as WorkTagCreate[]
      return this.transaction(() => tags.map(tag => this.create(tag)))
    }

    if (operations.type === 'update') {
      // 批量更新字段
      const updates = operations.data as Array<{
        field: 'work_id' | 'tag_name'
        oldValue: string | number
        newValue: string | number | null
      }>

      let totalChanges = 0

      for (const update of updates) {
        // 使用白名单验证字段名，防止SQL注入
        const allowedFields = ['work_id', 'tag_name']
        if (!allowedFields.includes(update.field)) {
          throw new Error(`不允许的字段名: ${update.field}`)
        }

        // 验证参数
        if (update.field === 'tag_name') {
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

        const changes = super.execute(`UPDATE works_tags SET ${update.field} = ? WHERE ${update.field} = ?`,
          [update.newValue, update.oldValue]).changes
        totalChanges += changes
      }

      return totalChanges
    }

    throw new Error(`不支持的批量操作类型: ${operations.type}`)
  }

  /**
   * 统一删除作品标签
   * 支持根据作品ID、标签名或组合条件删除
   * @param conditions - 删除条件对象
   * @returns 受影响的行数
   */
  remove(workId?: number, tagName?: string): number {
    let sql = 'DELETE FROM works_tags WHERE 1=1'
    const values: unknown[] = []

    if (workId && validateId(workId, '作品ID')) {
      sql += ' AND work_id = ?'
      values.push(workId)
    }

    if (tagName && validateString(tagName, '标签名')) {
      sql += ' AND tag_name = ?'
      values.push(tagName)
    }

    // 如果没有提供任何条件，防止误删所有数据
    if (values.length === 0) {
      throw new Error('必须提供至少一个删除条件')
    }

    return super.execute(sql, values).changes
  }

  /**
   * 获取所有标签及其使用次数
   * @returns 标签统计数组，包含标签名和使用次数
   */
  getAllTags(): { tag_name: string; count: number }[] {
    const sql = 'SELECT tag_name, COUNT(*) as count FROM works_tags GROUP BY tag_name ORDER BY count DESC'
    return super.query(sql) as unknown as { tag_name: string; count: number }[]
  }


}
