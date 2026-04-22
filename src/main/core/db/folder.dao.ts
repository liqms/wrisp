import { BaseDao } from './base.dao'
import { Folder, FolderCreate, FolderUpdate, FolderQuery, FolderStatus } from '@/main/types/db'
import { validateId, validateString, validateFilePath } from '@/shared/utils/validate'
import { PaginationResult } from '@/shared/utils/pagination'

/**
 * 带统计信息的文件夹树节点类型
 */
export interface FolderTreeWithStats extends Folder {
  level: number
  children: FolderTreeWithStats[]
  total_file_count: number
  total_folder_count: number
  total_size: number
}

/**
 * 文件夹数据访问对象
 * 提供文件夹相关的数据库操作方法
 */
export class FolderDao extends BaseDao<Folder, FolderCreate, FolderUpdate> {
  /**
   * 构造函数
   * 初始化文件夹 DAO，指定表名为 'folders'
   */
  constructor() {
    super('folders', {
      enabled: true,
      createdAtField: 'created_at',
      updatedAtField: 'updated_at'
    })
  }

  /**
   * 创建文件夹记录
   * @param data - 文件夹创建数据
   * @returns 新创建文件夹的 ID
   * @throws {Error} 当文件夹名或路径为空时抛出错误
   */
  create(data: FolderCreate): number {
    if (!validateString(data.name, '文件夹名称') || !validateFilePath(data.path, '文件夹路径') || !validateFilePath(data.full_path, '文件夹完整路径')) {
      throw new Error('文件夹名称、路径和完整路径不能为空')
    }

    const defaults: FolderCreate = {
      ...data,
      status: 1,
    }
    return super.create(defaults)
  }

  /**
   * 统一查询文件夹列表
   * 支持多种查询条件组合
   * @param params - 查询参数对象
   * @returns 符合条件的文件夹列表分页结果
   */
  findByParams(params: FolderQuery): PaginationResult<Folder> {
    const queryParams = {
      page: params.page || 1,
      page_size: params.page_size || 10,
      order_by: params.order_by || 'created_at',
      order_dir: params.order_dir || 'DESC',
      conditions: {
        work_id: params.work_id,
        parent_id: params.parent_id,
        name: params.name,
        path: params.path,
        primary_type: params.primary_type,
        status: params.status !== undefined ? params.status : 1 // 默认只查询有效文件夹
      }
    }
    return super.paginate(queryParams)
  }


  /**
   * 获取带统计信息的文件夹树形结构
   * 根据数据量自动选择递归查询或批量查询模式
   * @param parentId - 父文件夹 ID，null 表示根目录
   * @param options - 配置选项
   * @returns 带统计信息的文件夹树数组
   */
  getTreeWithStats(parentId: number | null = null, options: {
    level?: number
    maxRecursiveDepth?: number
  } = {}): FolderTreeWithStats[] {
    const {
      level = 0,
      maxRecursiveDepth = 10
    } = options

    // 如果层级超过最大深度，返回空数组防止无限递归
    if (level > maxRecursiveDepth) {
      return []
    }

    // 获取所有文件夹数据
    let allFolders: Folder[] = []
    if (parentId !== null) {
      const sql = 'SELECT * FROM folders WHERE parent_id = ? and status = 1'
      const params = [parentId]
      allFolders = this.query(sql, params) || []
    } else {
      const sql = 'SELECT * FROM folders WHERE status = 1'
      allFolders = this.query(sql) || []
    }

    // 构建文件夹映射表
    const folderMap = new Map<number | null, FolderTreeWithStats[]>()
    allFolders.forEach(folder => {
      const parentId = folder.parent_id
      if (!folderMap.has(parentId)) {
        folderMap.set(parentId, [])
      }
      folderMap.get(parentId)!.push({
        ...folder,
        level: 0, // 将在递归中计算
        children: [],
        total_file_count: folder.file_count,
        total_folder_count: folder.folder_count,
        total_size: folder.size
      })
    })

    // 递归构建树形结构
    const buildTree = (currentParentId: number | null, currentLevel: number): FolderTreeWithStats[] => {
      if (currentLevel > maxRecursiveDepth) return []

      const folders = folderMap.get(currentParentId) || []

      return folders.map(folder => {
        const children = buildTree(folder.id, currentLevel + 1)
        const totalFileCount = children.reduce((sum, child) => sum + child.total_file_count, 0) + folder.file_count
        const totalFolderCount = children.reduce((sum, child) => sum + child.total_folder_count, 0) + folder.folder_count
        const totalSize = children.reduce((sum, child) => sum + child.total_size, 0) + folder.size

        return {
          ...folder,
          level: currentLevel,
          children,
          total_file_count: totalFileCount,
          total_folder_count: totalFolderCount,
          total_size: totalSize
        }
      })
    }

    return buildTree(parentId, level)
  }

  /**
   * 统一更新文件夹信息
   * 支持更新大小、计数、路径等多种字段
   * @param conditions - 更新条件对象
   * @returns 受影响的行数
   * @throws {Error} 当参数无效时抛出错误
   */
  updateByField(conditions: {
    id: number
    field: 'size' | 'file_count' | 'folder_count' | 'path' | 'full_path' | 'primary_type'
    value: number | string
  }): number {
    // 字段白名单验证
    const allowedFields = ['size', 'file_count', 'folder_count', 'path', 'full_path', 'primary_type']
    if (!allowedFields.includes(conditions.field)) {
      throw new Error(`不允许的字段名: ${conditions.field}`)
    }

    // 构建SQL语句
    let sql = `UPDATE folders SET ${conditions.field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    const values: unknown[] = [conditions.value, conditions.id]

    return super.execute(sql, values).changes
  }

  /**
   * 统一批量操作文件夹字段
   * 支持批量创建和批量更新操作
   * @param operations - 批量操作配置
   * @returns 操作结果（创建返回ID数组，更新返回影响行数）
   */
  batch(operations: {
    type: 'create' | 'update'
    data: FolderCreate[] | Array<{
      field: 'folder_id' | 'work_id' | 'status' | 'primary_type'
      oldValue: string | number
      newValue: string | number | null
    }>
  }): number[] | number {
    if (operations.type === 'create') {
      // 批量创建文件夹
      const folders = operations.data as FolderCreate[]
      return this.transaction(() => folders.map(folder => this.create(folder)))
    }

    if (operations.type === 'update') {
      // 批量更新字段
      const updates = operations.data as Array<{
        field: 'folder_id' | 'work_id' | 'status' | 'primary_type'
        oldValue: string | number
        newValue: string | number | null
      }>
      let totalChanges = 0
      for (const update of updates) {
        // 使用白名单验证字段名，防止SQL注入
        const allowedFields = ['folder_id', 'work_id', 'status', 'primary_type']
        if (!allowedFields.includes(update.field)) {
          throw new Error(`不允许的字段名: ${update.field}`)
        }

        // 验证参数
        if (update.field === 'primary_type') {
          if (!validateString(update.oldValue as string, `旧${update.field}值`)) {
            throw new Error(`${update.oldValue}无效`)
          }
          if (!validateString(update.newValue as string, `新${update.field}值`)) {
            throw new Error(`新${update.newValue}无效`)
          }
        } else {
          if (!validateId(update.oldValue as number, `旧${update.field}值`)) {
            throw new Error(`${update.field}值无效`)
          }
          if (update.newValue !== null && !validateId(update.newValue as number, `新${update.field}值`)) {
            throw new Error(`新${update.field}值无效`)
          }
        }
        const changes = super.execute(`UPDATE folders SET ${update.field} = ?, updated_at = CURRENT_TIMESTAMP WHERE ${update.field} = ?`,
          [update.newValue, update.oldValue]).changes
        totalChanges += changes

      }
      return totalChanges


    }

    throw new Error(`不支持的批量操作类型: ${operations.type}`)
  }

  /**
   * 统一统计文件夹数量
   * 支持多种条件组合统计
   * @param conditions - 统计条件对象
   * @returns 符合条件的文件夹数量
   */
  countByConditions(conditions: {
    status?: FolderStatus
    workId?: number
    parentId?: number | null
  } = {}): number {
    let sql = 'SELECT * FROM folders WHERE 1=1'
    const values: unknown[] = []

    if (conditions.status !== undefined) {
      sql += ' AND status = ?'
      values.push(conditions.status)
    }

    if (conditions.workId && validateId(conditions.workId, '作品ID')) {
      sql += ' AND work_id = ?'
      values.push(conditions.workId)
    }

    if (conditions.parentId !== undefined) {
      sql += conditions.parentId === null ? ' AND parent_id IS NULL' : ' AND parent_id = ?'
      if (conditions.parentId !== null && conditions.parentId > 0) values.push(conditions.parentId)
    }

    return super.count(sql, values)
  }
}
