import { BaseDao } from './base.dao'
import { File, FileCreate, FileUpdate, FileQuery, FileStatus } from '@/main/types/db'
import { validateId, validateString, validateFilePath } from '@/shared/utils/validate'
import { PaginationResult } from '@/shared/utils/pagination'

/**
 * 文件数据访问对象
 * 提供文件相关的数据库操作方法
 */
export class FileDao extends BaseDao<File, FileCreate, FileUpdate> {
  /**
   * 构造函数
   * 初始化文件 DAO，指定表名为 'files'
   */
  constructor() {
    super('files', {
      enabled: true,
      createdAtField: 'created_at',
      updatedAtField: 'updated_at',
    })
  }

  /**
   * 创建文件记录
   * @param data - 文件创建数据
   * @returns 新创建文件的 ID
   * @throws {Error} 当文件名或路径为空时抛出错误
   */
  create(data: FileCreate): number {
    if (!validateString(data.name, '文件名') || !validateFilePath(data.path, '文件路径') || !validateFilePath(data.full_path, '文件完整路径')) {
      throw new Error('文件名称、路径和完整路径不能为空')
    }

    const defaults: FileCreate = {
      is_symlink: 0,
      status: 1,
      version_number: 0,
      ...data,
    }
    return super.create(defaults)
  }

  /**
   * 统一查询文件列表
   * 支持多种查询条件组合
   * @param params - 查询参数对象
   * @returns 符合条件的文件列表分页结果
   */
  findByParams(params: FileQuery): PaginationResult<File> {
    const queryParams = {
      page: params.page || 1,
      pageSize: params.page_size || 10,
      orderBy: params.order_by || 'id',
      orderDir: params.order_dir || 'ASC',
      conditions: {
        folder_id: params.folder_id,
        work_id: params.work_id,
        name: params.name,
        path: params.path,
        extension: params.extension,
        type: params.type,
        status: params.status,
        primary_type: params.primary_type,
      }
    }
    return super.paginate(queryParams)
  }


  /**
   * 统一更新文件信息
   * 支持更新哈希值、大小、状态等多种字段
   * @param conditions - 更新条件对象
   * @returns 受影响的行数
   * @throws {Error} 当参数无效时抛出错误
   */
  updateByField(conditions: {
    id: number
    field: 'hash_md5' | 'hash_sha256' | 'size' | 'status' | 'word_count' | 'duration' | 'type' | 'name' | 'path' | 'full_path' | 'status' | 'folder_id' | 'work_id' | 'version_number'
    value: string | number
    md5?: string
    sha256?: string
  }): number {
    if (!validateId(conditions.id, '文件ID')) {
      throw new Error('文件ID无效')
    }

    // 字段白名单验证
    const allowedFields = ['hash_md5', 'hash_sha256', 'size', 'status', 'word_count', 'duration', 'type', 'name', 'path', 'full_path', 'status', 'folder_id', 'work_id', 'version_number']
    if (!allowedFields.includes(conditions.field)) {
      throw new Error(`不允许的字段名: ${conditions.field}`)
    }

    // 特殊处理：同时更新MD5和SHA256
    if (conditions.md5 && conditions.sha256) {
      return super.execute('UPDATE files SET hash_md5 = ?, hash_sha256 = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [conditions.md5, conditions.sha256, conditions.id]).changes
    }

    // 通用字段更新
    return super.execute(`UPDATE files SET ${conditions.field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [conditions.value, conditions.id]).changes
  }

  /**
   * 查找重复文件
   * 支持基于哈希值、文件大小、文件名等多种方式查找重复文件
   * @param options - 查找选项
   * @returns 重复文件列表
   */
  findDuplicates(options: {
    byHash?: boolean
    bySize?: boolean
    byName?: boolean
    minSize?: number
    status?: FileStatus
  } = {}): File[] {
    const {
      byHash = true,
      bySize = false,
      byName = false,
      minSize = 0,
      status = 1
    } = options

    // 默认基于哈希值查找
    if (byHash) {
      const sql = `
        SELECT f.* FROM files f
        JOIN (SELECT hash_md5 FROM files 
              WHERE hash_md5 IS NOT NULL AND hash_md5 != '' AND status = ? AND size >= ?
              GROUP BY hash_md5 HAVING COUNT(*) > 1) duplicates 
        ON f.hash_md5 = duplicates.hash_md5
        WHERE f.status = ? ORDER BY f.hash_md5, f.path
      `
      return super.query(sql, [status, minSize, status])
    }

    // 基于文件大小查找
    if (bySize) {
      const sql = `
        SELECT f.* FROM files f
        JOIN (SELECT size FROM files 
              WHERE size >= ? AND status = ?
              GROUP BY size HAVING COUNT(*) > 1) duplicates 
        ON f.size = duplicates.size
        WHERE f.status = ? ORDER BY f.size, f.path
      `
      return super.query(sql, [minSize, status, status])
    }

    // 基于文件名查找
    if (byName) {
      const sql = `
        SELECT f.* FROM files f
        JOIN (SELECT name FROM files 
              WHERE status = ? AND size >= ?
              GROUP BY name HAVING COUNT(*) > 1) duplicates 
        ON f.name = duplicates.name
        WHERE f.status = ? ORDER BY f.name, f.path
      `
      return super.query(sql, [status, minSize, status])
    }

    // 默认返回空数组
    return []
  }

  /**
   * 统一批量操作文件
   * 支持批量创建和批量更新操作
   * @param operations - 批量操作配置
   * @returns 操作结果（创建返回ID数组，更新返回影响行数）
   */
  batch(operations: {
    type: 'create' | 'update'
    data: FileCreate[] | Array<{
      field: 'status' | 'type' | 'name' | 'folder_id' | 'work_id'
      oldValue: string | number
      newValue: string | number | null
    }>
  }): number[] | number {
    if (operations.type === 'create') {
      // 批量创建文件
      const files = operations.data as FileCreate[]
      return this.transaction(() => files.map(file => this.create(file)))
    }

    if (operations.type === 'update') {
      // 批量更新字段
      const updates = operations.data as Array<{
        field: 'status' | 'folder_id' | 'work_id' | 'path' | 'full_path'
        oldValue: string | number
        newValue: string | number | null
      }>

      let totalChanges = 0

      for (const update of updates) {
        // 使用白名单验证字段名，防止SQL注入
        const allowedFields = ['status', 'folder_id', 'work_id', 'path', 'full_path']
        if (!allowedFields.includes(update.field)) {
          throw new Error(`不允许的字段名: ${update.field}`)
        }

        // 验证参数
        if (update.field === 'path' || update.field === 'full_path') {
          if (!validateFilePath(update.oldValue as string, '旧路径') || !validateFilePath(update.newValue as string, '新路径')) {
            throw new Error('路径参数无效')
          }
        } else if (update.field === 'folder_id' || update.field === 'work_id') {
          if (!validateId(update.oldValue as number, `旧${update.field}值`)) {
            throw new Error(`${update.field}值无效`)
          }
          if (update.newValue !== null && !validateId(update.newValue as number, `新${update.field}值`)) {
            throw new Error(`新${update.field}值无效`)
          }
        } else {
          if (update.newValue !== null && typeof update.newValue !== 'number') {
            throw new Error(`${update.field}参数无效`)
          }
        }

        const changes = super.execute(`UPDATE files SET ${update.field} = ?, updated_at = CURRENT_TIMESTAMP WHERE ${update.field} = ?`,
          [update.newValue, update.oldValue]).changes
        totalChanges += changes
      }

      return totalChanges
    }

    throw new Error(`不支持的批量操作类型: ${operations.type}`)
  }

}
