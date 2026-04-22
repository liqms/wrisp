import { BaseDao } from './base.dao'
import { FileVersion, FileVersionCreate, FileVersionUpdate, FileVersionQuery, FileVersionStats, FileSize, ChangeType } from '@/main/types/db'
import { validateId, validateString } from '@/shared/utils/validate'
import { PaginationResult } from '@/shared/utils/pagination'

/**
 * 文件版本数据访问对象
 * 提供文件版本相关的数据库操作方法
 */
export class FileVersionDao extends BaseDao<FileVersion, FileVersionCreate, FileVersionUpdate> {
  /**
   * 构造函数
   * 初始化文件版本 DAO，指定表名为 'file_versions'
   */
  constructor() {
    super('file_versions', { 
      enabled: true,
      createdAtField: 'created_at'
    })
  }

  /**
   * 创建文件版本记录
   * @param data - 文件版本创建数据
   * @returns 新创建文件版本的 ID
   * @throws {Error} 当参数无效时抛出错误
   */
  create(data: FileVersionCreate): number {
    if (!validateId(data.file_id, '文件ID') || !validateString(data.change_type, '变更类型')) {
      throw new Error('文件ID、版本号和变更类型不能为空')
    }

    const defaults: FileVersionCreate = {
      ...data,
      size: data.size || 0,
      description: data.description || ''
    }
    return super.create(defaults)
  }

  /**
   * 统一查询文件版本列表
   * 支持多种查询条件组合
   * @param params - 查询参数对象
   * @returns 符合条件的文件版本列表分页结果
   */
  findByParams(params: FileVersionQuery): PaginationResult<FileVersion> {
    const queryParams = {
      page: params.page || 1,
      pageSize: params.page_size || 10,
      orderBy: params.order_by || 'version_number',
      orderDir: params.order_dir || 'DESC',
      conditions: {
        file_id: params.file_id,
        version_number: params.version_number,
        change_type: params.change_type,
      }
    }
    return super.paginate(queryParams)
  }

  /**
   * 统一更新文件版本信息
   * 支持更新大小、描述、变更类型等多种字段
   * @param conditions - 更新条件对象
   * @returns 受影响的行数
   * @throws {Error} 当参数无效时抛出错误
   */
  updateByField(conditions: {
    id: number
    field: 'size' | 'description' | 'change_type'
    value: string | number
  }): number {
    if (!validateId(conditions.id, '文件版本ID')) {
      throw new Error('文件版本ID无效')
    }

    // 字段白名单验证
    const allowedFields = ['size', 'description', 'change_type']
    if (!allowedFields.includes(conditions.field)) {
      throw new Error(`不允许的字段名: ${conditions.field}`)
    }

    // 构建SQL语句
    const sql = `UPDATE file_versions SET ${conditions.field} = ? WHERE id = ?`
    
    return super.execute(sql, [conditions.value, conditions.id]).changes
  }

  /**
   * 统一批量操作文件版本
   * 支持批量创建和批量更新操作
   * @param operations - 批量操作配置
   * @returns 操作结果（创建返回ID数组，更新返回影响行数）
   */
  batch(operations: {
    type: 'create' | 'update'
    data: FileVersionCreate[] | Array<{
      field: 'file_id' | 'version_number' | 'change_type'
      oldValue: string | number
      newValue: string | number | null
    }>
  }): number[] | number {
    if (operations.type === 'create') {
      // 批量创建文件版本
      const versions = operations.data as FileVersionCreate[]
      return this.transaction(() => versions.map(version => this.create(version)))
    }

    if (operations.type === 'update') {
      // 批量更新字段
      const updates = operations.data as Array<{
        field: 'file_id' | 'version_number' | 'change_type'
        oldValue: string | number
        newValue: string | number | null
      }>

      let totalChanges = 0

      for (const update of updates) {
        // 使用白名单验证字段名，防止SQL注入
        const allowedFields = ['file_id', 'version_number', 'change_type']
        if (!allowedFields.includes(update.field)) {
          throw new Error(`不允许的字段名: ${update.field}`)
        }

        // 验证参数
        if (update.field === 'change_type') {
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

        const changes = super.execute(`UPDATE file_versions SET ${update.field} = ? WHERE ${update.field} = ?`,
          [update.newValue, update.oldValue]).changes
        totalChanges += changes
      }

      return totalChanges
    }

    throw new Error(`不支持的批量操作类型: ${operations.type}`)
  }

  /**
   * 获取文件的版本信息
   * 一次性获取最新版本、版本统计信息
   * @param fileId - 文件 ID
   * @returns 文件版本信息对象
   */
  getFileVersionInfo(fileId: number): {
    latestVersion: FileVersion | null
    stats: FileVersionStats | null
  } {
    if (!validateId(fileId, '文件ID')) {
      return {
        latestVersion: null,
        stats: null
      }
    }

    // 获取最新版本
    const latestVersionSql = 'SELECT * FROM file_versions WHERE file_id = ? ORDER BY version_number DESC LIMIT 1'
    const latestVersion = super.queryOne(latestVersionSql, [fileId])

    // 统计文件总大小
    const totalSizeSql = `SELECT SUM(size) AS total_size FROM file_versions WHERE file_id = ?`
    const totalSize = super.queryOne(totalSizeSql, [fileId]) as unknown as { total_size: FileSize }

    // 统计文件版本数量
    const versionCountSql = `SELECT COUNT(*) AS version_count FROM file_versions WHERE file_id = ?`
    const versionCount = super.queryOne(versionCountSql, [fileId]) as unknown as { version_count: number }

    // 统计文件版本变更类型
    const changeTypesSql = `SELECT change_type, COUNT(change_type) AS change_count FROM file_versions WHERE file_id = ? GROUP BY change_type`
    const changeTypes = super.query(changeTypesSql, [fileId]) as unknown as { change_type: ChangeType, change_count: number }[]

    // 计算平均版本大小
    const averageSize = versionCount?.version_count ? totalSize?.total_size / versionCount?.version_count : 0

    // 统计文件版本变更类型数量
    const changeTypesRecord = changeTypes.reduce((acc, cur) => {
      acc[cur.change_type] = cur.change_count
      return acc
    }, {} as Record<ChangeType, number>)

    return {
      latestVersion,
      stats: {
        version_count: versionCount?.version_count || 0,
        total_size: totalSize?.total_size || 0,
        average_size: averageSize,
        change_types: changeTypesRecord
      }
    }
  }

  /**
   * 根据文件 ID 删除所有版本记录
   * @param fileId - 文件 ID
   * @returns 受影响的行数
   */
  deleteByFileId(fileId: number): number {
    if (!validateId(fileId, '文件ID')) return 0
    return super.execute('DELETE FROM file_versions WHERE file_id = ?', [fileId]).changes
  }

  /**
   * 统一删除文件版本记录
   * 支持根据文件ID、版本号或组合条件删除
   * @param conditions - 删除条件对象
   * @returns 受影响的行数
   */
  remove(conditions: { fileId?: number; versionNumber?: number }): number {
    let sql = 'DELETE FROM file_versions WHERE 1=1'
    const values: unknown[] = []

    if (conditions.fileId && validateId(conditions.fileId, '文件ID')) {
      sql += ' AND file_id = ?'
      values.push(conditions.fileId)
    }

    if (conditions.versionNumber && validateId(conditions.versionNumber, '版本号')) {
      sql += ' AND version_number = ?'
      values.push(conditions.versionNumber)
    }

    // 如果没有提供任何条件，防止误删所有数据
    if (values.length === 0) {
      throw new Error('必须提供至少一个删除条件')
    }

    return super.execute(sql, values).changes
  }
}
