import fs from 'fs'
import path from 'path'
import { FolderDao, CompositeDao } from '../db'
import { Logger } from '@/main/utils/logger'
import { Folder, FolderCreate, FolderUpdate, File } from '@/main/types/db'
import {
  CreateFolderRequest,
  UpdateFolderRequest,
  FolderQueryRequest,
  FolderTreeWithStats
} from '@/shared/types'
import { configService } from './config.service'
import { PaginationResult } from '@/shared/utils/pagination'

/**
 * 文件夹服务
 * 提供文件夹的业务逻辑处理，包括文件夹的创建、查询、更新、删除等操作
 * 同时处理物理文件夹操作和数据库记录的同步
 */
class FolderService {
  private static instance: FolderService | null = null
  private folderDao: FolderDao
  private compositeDao: CompositeDao
  private workspaceDir: string


  /**
   * 私有构造函数
   * 初始化文件夹服务实例，创建所需的 DAO 实例
   */
  private constructor() {
    this.folderDao = new FolderDao()
    this.compositeDao = new CompositeDao()
    this.workspaceDir = this.getWorkspaceDir()
    Logger.info('FolderService 初始化完成')
  }

  /**
   * 获取 FolderService 的单例实例
   * @returns FolderService 单例实例
   */
  public static getInstance(): FolderService {
    if (!FolderService.instance) {
      FolderService.instance = new FolderService()
    }
    return FolderService.instance
  }

  /**
   * 获取工作区目录路径
   * @returns 工作区目录路径，未配置时返回空字符串
   */
  private getWorkspaceDir(): string {
    return configService.getValue<string>('workspace') || ''
  }

  /**
   * 创建文件夹
   * 在物理文件系统中创建文件夹，并在数据库中记录文件夹信息
   * @param request - 创建文件夹请求对象
   * @param request.name - 文件夹名称
   * @param request.path - 文件夹路径（绝对路径或相对路径）
   * @param request.parent_id - 父文件夹 ID，可选
   * @param request.work_id - 作品 ID，可选
   * @param request.description - 文件夹描述，可选
   * @returns 创建成功的文件夹对象
   * @throws {Error} 当物理文件夹创建失败时抛出错误
   * @throws {Error} 当数据库记录创建失败时抛出错误
   */
  public create(request: CreateFolderRequest): Folder {
    const workTypeFields = ['novel', 'article', 'manga', 'video', 'audio']
    if (!workTypeFields.includes(request.work_type)) {
      throw new Error(`不允许的字段名: ${request.work_type}`)
    }

    const { folderPath, full_path } = this.generateUniqueFolderPath({ parentPath: request.work_type })
    const absoluteFilePath = path.join(this.workspaceDir, full_path)

    try {
      fs.mkdirSync(absoluteFilePath, { recursive: true })
      Logger.info('物理创建文件夹成功', { path: absoluteFilePath })
    } catch (error) {
      throw new Error(`物理创建文件夹失败: ${(error as Error).message}`)
    }
    const fileStats = fs.statSync(absoluteFilePath)

    const folderCreate: FolderCreate = {
      parent_id: request.parent_id || null,
      work_id: request.work_id || null,
      name: request.name,
      path: folderPath,
      full_path: full_path,
      description: request.description || undefined,
      created_at: fileStats.atime.toISOString(),
      size: fileStats.size,
      file_count: 0,
      folder_count: 0
    }

    const id = this.folderDao.create(folderCreate)
    const folder = this.folderDao.findById(id)

    if (!folder) {
      fs.rmSync(absoluteFilePath, { recursive: true, force: true })
      throw new Error('创建文件夹失败')
    }

    Logger.info('数据库记录文件夹成功', { folderId: id, folderName: request.name, path: absoluteFilePath })
    return folder
  }

  /**
   * 根据 ID 获取文件夹基本信息
   * 支持通过文件夹 ID 或文件夹路径查询文件夹基本信息
   * @param identifier - 文件标识符，可以是文件夹 ID 或文件夹路径
   * @returns 文件夹对象，未找到时返回 null
   */
  public getInfo(identifier: number | string): Folder | null {
    if (typeof identifier === 'number') {
      // 通过 ID 查询
      return this.folderDao.findById(identifier)
    } else {
      // 通过路径 查询
      const folder = this.folderDao.findByParams({ path: identifier })
      return folder ? folder.data[0] : null
    }
  }

  /**
   * 获取文件夹详细信息, 包含文件列表
   * 查询文件夹信息及其包含的文件列表，支持通过文件夹 ID 或文件夹路径查询
   * @param identifier - 文件夹 ID 或文件夹路径
   * @returns 文件夹对象（包含文件列表），未找到时返回 null
   */
  public getDetail(identifier: number): (Folder & { files: File[] }) | null {
    const options = {
      entityType: 'folder' as ('folder' | 'work' | 'file'),
      identifier: identifier,
      include: ['files'] as ('files' | 'tags' | 'versions')[]
    }
    return this.compositeDao.getEntityWithRelatedData(options)
  }

  /**
   * 查询文件夹列表
   * 根据查询参数查询符合条件的文件夹列表
   * @param request - 查询参数对象
   * @returns 符合条件的文件夹列表
   */
  public query(request: FolderQueryRequest): PaginationResult<Folder> {
    const queryParams = {
      page: request.page || 1,
      pageSize: request.page_size || 10,
      orderBy: request.order_by || 'id',
      orderDir: request.order_dir || 'asc',
      conditions: {
        parent_id: request.parent_id,
        work_id: request.work_id,
        name: request.name,
        path: request.path,
        status: request.status
      }
    }
    return this.folderDao.findByParams(queryParams)
  }

  /**
   * 获取文件夹树结构及统计信息
   * 递归查询文件夹树，包含每个文件夹的统计信息
   * @param parentId - 父文件夹 ID，为 null 时从根文件夹开始
   * @returns 文件夹树数组，包含统计信息
   */
  public getTreeWithStats(parentId: number): FolderTreeWithStats[] {
    const folder = this.folderDao.findById(parentId)
    if (!folder) {
      return []
    }
    const tree = this.folderDao.getTreeWithStats(parentId)
    return tree as FolderTreeWithStats[]
  }

  /**
   * 更新文件夹
   * 支持更新文件夹名称、路径、作品关联和描述，同步更新物理文件夹和数据库记录
   * @param id - 文件夹 ID
   * @param request - 更新请求对象
   * @param request.parent_id - 新父文件夹 ID，可选
   * @param request.work_id - 新作品 ID，可选
   * @param request.name - 新文件夹名称，可选
   * @param request.path - 新文件夹路径，可选
   * @param request.description - 新文件夹描述，可选
   * @returns 更新影响的行数
   * @throws {Error} 当文件夹不存在时抛出错误
   * @throws {Error} 当物理文件夹操作失败时抛出错误
   */
  public update(id: number, request: UpdateFolderRequest): number {
    const existingFolder = this.folderDao.findById(id)
    if (!existingFolder) {
      throw new Error('文件夹不存在')
    }

    const folderUpdate: FolderUpdate = {
      parent_id: request.parent_id,
      work_id: request.work_id,
      name: request.name,
      description: request.description
    }

    const changes = this.folderDao.update(id, folderUpdate)

    if (changes > 0) {
      Logger.info('数据库更新文件夹成功', { folderId: id, changes })
    }

    return changes
  }

  /**
   * 永久删除文件夹
   * 删除物理文件夹及其所有内容，同时删除数据库记录
   * @param id - 文件夹 ID
   * @returns 删除影响的行数
   * @throws {Error} 当文件夹不存在时抛出错误
   * @throws {Error} 当物理文件夹删除失败时抛出错误
   */
  public delete(id: number): number {
    const folder = this.folderDao.findById(id)
    if (!folder) {
      return 0
    }
    const absolutePath = path.resolve(this.workspaceDir, folder.full_path)

    try {
      fs.rmSync(absolutePath, { recursive: true, force: true })
      Logger.info('物理删除文件夹成功', { path: absolutePath })
    } catch (error) {
      throw new Error(`物理删除文件夹失败: ${(error as Error).message}`)
    }

    const changes = this.folderDao.delete(id)

    if (changes > 0) {
      Logger.info('数据库删除文件夹成功', { folderId: id })
    }

    return changes
  }

  /**
   * 批量移动文件夹到新父文件夹
   * @param oldParentId - 原父文件夹 ID
   * @param newParentId - 新父文件夹 ID，为 null 时表示移动到根级别
   * @returns 更新影响的行数
   */
  public batchMove(folderIds: number[], newParentId: number | null): number {
    let changes = 0
    let newParentPath: string | null = null
    let absoluteNewParentPath: string | null = null
    if (newParentId === null) {
      absoluteNewParentPath = this.workspaceDir
    } else {
      const newParentFolder = this.folderDao.findById(newParentId)
      newParentPath = newParentFolder?.full_path || ''
      if (!newParentFolder) {
        Logger.warn('移动文件夹失败，新父文件夹不存在', { newParentId })
        return 0
      }
      absoluteNewParentPath = path.join(this.workspaceDir, newParentPath)
    }
    for (const folderId of folderIds) {
      const folder = this.folderDao.findById(folderId)
      if (!folder) {
        Logger.warn('移动文件夹失败，文件夹不存在', { folderId })
        continue
      }
      try {
        const absolutePath = path.join(this.workspaceDir, folder.full_path)
        const absoluteNewFullPath = path.join(absoluteNewParentPath, folder.path)
        fs.renameSync(absolutePath, absoluteNewFullPath)
        Logger.info('物理移动文件夹成功', { path: folder.full_path, newPath: absoluteNewFullPath })
      } catch (error) {
        Logger.warn('移动文件夹失败，物理移动失败', {
          folderId,
          error: error instanceof Error ? error.message : String(error)
        })
        continue
      }
      const folderUpdate: FolderUpdate = {
        parent_id: newParentId,
        full_path: path.join(newParentPath || '', folder.path)
      }
      changes += this.folderDao.update(folderId, folderUpdate)
    }
    return changes
  }

  /**
   * 生成唯一文件夹路径
   * 为新创建的文件夹生成一个唯一的文件夹路径，包含时间戳和随机数
   * @param parentPath - 父文件夹路径
   * @returns 唯一文件夹路径，格式为 "parentPath/folder_timestamp" 
   */
  private generateUniqueFolderPath(options: { parentPath: string, serial?: number }): { folderPath: string, full_path: string } {
    const { parentPath, serial } = options
    const now = Math.floor(Date.now() / 1000)
    const folderPath = `folder_${now}_${serial || 0}`
    const full_path = path.join(parentPath, folderPath)
    return { folderPath, full_path }

  }
}
export const folderService = FolderService.getInstance()
