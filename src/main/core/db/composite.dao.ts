import { FolderDao } from './folder.dao'
import { FileDao } from './file.dao'
import { WorkTagDao } from './workTag.dao'
import { FileVersionDao } from './fileVersion.dao'
import { WorkDao } from './work.dao'
import { Folder, File, Work, FileType } from '@/main/types/db'
import { Logger } from '@/main/utils/logger'
import { getDatabase } from './connection'
import { validateId, validateString } from '@/shared/utils/validate'

/**
 * 组合数据访问对象
 * 提供跨表的复杂查询操作方法
 */
export class CompositeDao {
  /** 文件夹数据访问对象 */
  private folderDao: FolderDao
  /** 文件数据访问对象 */
  private fileDao: FileDao
  /** 作品标签数据访问对象 */
  private workTagDao: WorkTagDao
  /** 文件版本数据访问对象 */
  private fileVersionDao: FileVersionDao
  /** 作品数据访问对象 */
  private workDao: WorkDao

  /**
   * 构造函数
   * 初始化各个数据访问对象
   */
  constructor() {
    this.folderDao = new FolderDao()
    this.fileDao = new FileDao()
    this.workTagDao = new WorkTagDao()
    this.fileVersionDao = new FileVersionDao()
    this.workDao = new WorkDao()
  }

  /**
   * 统一获取实体及其关联数据
   * 支持获取文件夹、作品、文件等实体及其关联的标签、文件、版本等数据
   * @param options - 查询选项
   * @returns 实体及其关联数据对象，未找到时返回 null
   * @throws {Error} 当数据库操作失败时抛出错误
   */
  getEntityWithRelatedData(options: {
    entityType: 'folder' | 'work' | 'file'
    identifier: number | string
    include?: ('files' | 'tags' | 'versions')[]
  }): any {
    try {
      const { entityType, identifier, include = [] } = options

      // 验证标识符
      if (typeof identifier === 'number' && !validateId(identifier, `${entityType}ID`)) {
        return null
      }
      if (typeof identifier === 'string' && !validateString(identifier, `${entityType}标识符`)) {
        return null
      }

      let entity: any = null
      let relatedData: any = {}

      // 根据实体类型获取基础实体
      switch (entityType) {
        case 'folder':
          if (typeof identifier === 'number') {
            entity = this.folderDao.findById(identifier)
          } else {
            const folder = this.folderDao.findByParams({ path: identifier }).data[0]
            entity = folder
          }
          if (!entity) {
            Logger.debug(`${entityType}不存在`, { identifier })
            return null
          }

          // 获取关联的文件
          if (include.includes('files')) {
            const files = this.fileDao.findByParams({ folder_id: entity.id, page_size: 100 }).data
            relatedData.files = files
          }
          break

        case 'work':
          if (typeof identifier !== 'number') {
            throw new Error('作品ID必须是数字类型')
          }
          entity = this.workDao.findById(identifier)
          if (!entity) {
            Logger.debug(`${entityType}不存在`, { identifier })
            return null
          }

          // 获取关联的标签
          if (include.includes('tags')) {
            const tags = this.workTagDao.findByParams({ work_id: entity.id, page_size: 100 }).data
            relatedData.tags = tags.map(t => t.tag_name)
          }
          break

        case 'file':
          if (typeof identifier !== 'number') {
            throw new Error('文件ID必须是数字类型')
          }
          entity = this.fileDao.findById(identifier)
          if (!entity) {
            Logger.debug(`${entityType}不存在`, { identifier })
            return null
          }

          // 获取关联的版本信息
          if (include.includes('versions')) {
            const versionInfo = this.fileVersionDao.getFileVersionInfo(entity.id)
            relatedData.versions = [versionInfo.latestVersion || {}]
          }
          break

        default:
          throw new Error(`不支持的实体类型: ${entityType}`)
      }

      Logger.debug(`获取${entityType}及关联数据完成`, {
        identifier,
        include,
        entityType,
        relatedDataCount: Object.keys(relatedData).length
      })

      return { ...entity, ...relatedData }
    } catch (error) {
      Logger.error(`获取${options.entityType}及关联数据失败:`, {
        error: String(error),
        options
      })
      throw error
    }
  }

  

  /**
   * 批量获取指定文件夹下的子文件夹和文件列表
   * @param folderIds - 文件夹 ID 列表
   * @param options - 查询选项
   * @param options.status - 状态过滤，默认只查询有效数据（status = 1）
   * @returns 包含每个文件夹下子文件夹和文件的结果对象
   * @throws {Error} 当数据库操作失败时抛出错误
   */
  getFolderContentsBatch(folderIds: number[], options: {
    status?: number
  } = {}): {
    folderId: number
    folders: Folder[]
    files: File[]
  }[] {
    try {
      // 参数验证
      if (!folderIds || folderIds.length === 0) {
        Logger.debug('未提供文件夹ID列表', { folderIds })
        return []
      }

      const status = options.status ?? 1

      // 验证文件夹ID
      for (const id of folderIds) {
        if (!validateId(id, '文件夹ID')) {
          throw new Error(`无效的文件夹ID: ${id}`)
        }
      }

      const results: {
        folderId: number
        folders: Folder[]
        files: File[]
      }[] = []

      for (const folderId of folderIds) {
        // 查询子文件夹
        const subFolders = this.folderDao.query(
          `SELECT * FROM folders WHERE parent_id = ? AND status = ?`,
          [folderId, status]
        )

        // 查询文件
        const files = this.fileDao.query(
          `SELECT * FROM files WHERE folder_id = ? AND status = ?`,
          [folderId, status]
        )

        results.push({
          folderId,
          folders: subFolders,
          files
        })
      }

      Logger.debug('批量获取文件夹内容完成', {
        folderCount: folderIds.length,
        totalFolders: results.reduce((sum, r) => sum + r.folders.length, 0),
        totalFiles: results.reduce((sum, r) => sum + r.files.length, 0)
      })

      return results
    } catch (error) {
      Logger.error('批量获取文件夹内容失败:', {
        error: String(error),
        folderIds,
        options
      })
      throw error
    }
  }

  /**
   * 统一搜索内容
   * 支持多种搜索模式：作品内容、标签搜索、最近访问、全局搜索等
   * @param options - 搜索选项
   * @returns 搜索结果对象
   * @throws {Error} 当数据库操作失败时抛出错误
   */
  searchWorkContent(options: {
    workId?: number
    searchType: 'all' | 'name' | 'tag' | 'recent' | 'works'
    keyword?: string
    includeFolders?: boolean
    limit?: number
  }): {
    folders?: Folder[]
    files?: File[]
    works?: Work[]
    totalCount: number
  } {
    try {
      const {
        workId,
        searchType = 'all',
        keyword = '',
        includeFolders = true,
        limit = 100
      } = options

      let folders: Folder[] = []
      let files: File[] = []
      let works: Work[] = []

      // 验证参数
      if (workId !== undefined && !validateId(workId, '作品ID')) {
        return { files: [], totalCount: 0 }
      }

      // 根据搜索类型执行不同的搜索逻辑
      switch (searchType) {
        case 'all':
          // 获取作品下的所有内容
          if (workId === undefined) {
            throw new Error('搜索类型为"all"时必须提供作品ID')
          }

          if (includeFolders) {
            folders = this.folderDao.findByParams({
              work_id: workId,
              status: 1,
              page_size: Math.min(limit, 100)
            }).data
          }

          files = this.fileDao.findByParams({
            work_id: workId,
            page_size: Math.min(limit, 100),
            status: 1
          }).data
          break

        case 'name':
          // 按文件名搜索
          if (!validateString(keyword, '搜索关键字')) {
            files = []
            break
          }

          let nameSql = `
            SELECT f.* 
            FROM files f
            WHERE f.name LIKE ? AND f.status = 1
          `
          const nameValues: unknown[] = [`%${keyword}%`]

          if (workId !== undefined) {
            nameSql += ' AND f.work_id = ?'
            nameValues.push(workId)
          }

          nameSql += ' ORDER BY f.updated_at DESC LIMIT ?'
          nameValues.push(Math.min(limit, 100))

          const nameStmt = getDatabase().prepare(nameSql)
          files = nameStmt.all(...nameValues) as File[]
          break

        case 'tag':
          // 按标签搜索（文件类型或作品标签）
          if (!validateString(keyword, '标签关键字')) {
            files = []
            works = []
            break
          }

          if (workId !== undefined) {
            // 在指定作品中按文件类型搜索
            files = this.fileDao.findByParams({
              work_id: workId,
              type: keyword as FileType | undefined,
              page_size: Math.min(limit, 100),
              status: 1
            }).data
          } else {
            // 全局按作品标签搜索
            let tagSql = `
              SELECT w.* 
              FROM works w
              JOIN work_tags wt ON w.id = wt.work_id
              WHERE wt.tag_name LIKE ? AND w.status = 1
            `
            const tagValues: unknown[] = [`%${keyword}%`]

            tagSql += ' ORDER BY w.updated_at DESC LIMIT ?'
            tagValues.push(Math.min(limit, 100))

            const tagStmt = getDatabase().prepare(tagSql)
            works = tagStmt.all(...tagValues) as Work[]
          }
          break

        case 'recent':
          // 获取最近访问的文件
          let recentSql = `
            SELECT f.* 
            FROM files f
            WHERE f.status = 1
          `
          const recentValues: unknown[] = []

          if (workId !== undefined) {
            recentSql += ' AND f.work_id = ?'
            recentValues.push(workId)
          }

          recentSql += ' ORDER BY f.updated_at DESC LIMIT ?'
          recentValues.push(Math.min(limit, 100))

          const recentStmt = getDatabase().prepare(recentSql)
          files = recentStmt.all(...recentValues) as File[]
          break

        case 'works':
          // 搜索作品（全局搜索）
          if (workId !== undefined) {
            throw new Error('搜索类型为"works"时不能提供作品ID')
          }

          if (validateString(keyword, '搜索关键字')) {
            let worksSql = `
              SELECT w.* 
              FROM works w
              WHERE w.name LIKE ? AND w.status = 1
            `
            const worksValues: unknown[] = [`%${keyword}%`]

            worksSql += ' ORDER BY w.updated_at DESC LIMIT ?'
            worksValues.push(Math.min(limit, 100))

            const worksStmt = getDatabase().prepare(worksSql)
            works = worksStmt.all(...worksValues) as Work[]
          }
          break

        default:
          throw new Error(`不支持的搜索类型: ${searchType}`)
      }

      const totalCount = folders.length + files.length + works.length

      Logger.debug('搜索内容完成', {
        workId,
        searchType,
        keyword,
        folderCount: folders.length,
        fileCount: files.length,
        workCount: works.length,
        totalCount
      })

      return {
        folders: includeFolders && folders.length > 0 ? folders : undefined,
        files: files.length > 0 ? files : undefined,
        works: works.length > 0 ? works : undefined,
        totalCount
      }
    } catch (error) {
      Logger.error('搜索内容失败:', {
        error: String(error),
        options
      })
      throw error
    }
  }

  /**
   * 递归删除文件夹及其所有子文件夹和文件
   * @param folderId - 文件夹 ID
   * @returns 删除结果，包含删除的文件夹数量和文件数量
   * @throws {Error} 当数据库操作失败时抛出错误
   */
  deleteFolderRecursive(folderId: number): { foldersDeleted: number; filesDeleted: number } {
    try {
      if (!validateId(folderId, '文件夹ID')) {
        return { foldersDeleted: 0, filesDeleted: 0 }
      }

      let filesDeleted = 0
      let foldersDeleted = 0

      this.folderDao.transaction(() => {
        // 1. 获取文件夹信息（用于物理删除）
        const folder = this.folderDao.findById(folderId)

        // 2. 递归删除所有子文件夹
        const subFolders = this.folderDao.findByParams({ parent_id: folderId }).data
        for (const subFolder of subFolders) {
          const subResult = this.deleteFolderRecursive(subFolder.id)
          filesDeleted += subResult.filesDeleted
          foldersDeleted += subResult.foldersDeleted
        }

        // 3. 删除文件夹中的所有文件
        const files = this.fileDao.findByParams({ folder_id: folderId }).data
        const fileDeleteResult = this.deleteFilesWithRelatedData(files)
        filesDeleted += fileDeleteResult.filesDeleted

        // 4. 删除文件夹数据库记录
        foldersDeleted += this.folderDao.delete(folderId)

        // 5. 物理删除文件夹（如果存在）
        if (folder && folder.path && folder.full_path) {
          try {
            if (require('fs').existsSync(folder.path)) {
              require('fs').rmSync(folder.path, { recursive: true, force: true })
              Logger.info('物理删除文件夹成功', { path: folder.path })
            }
          } catch (error) {
            Logger.warn('物理删除文件夹失败:', { error: String(error), path: folder.path })
          }
        }
      })

      Logger.debug('递归删除文件夹完成', { folderId, foldersDeleted, filesDeleted })
      return { foldersDeleted, filesDeleted }
    } catch (error) {
      Logger.error('递归删除文件夹失败:', { error: String(error), folderId })
      throw error
    }
  }

  /**
   * 递归删除作品及其所有相关文件夹和文件
   * 删除作品记录、作品标签、文件夹、文件、文件版本等所有关联数据
   * @param workId - 作品 ID
   * @returns 删除结果，包含删除的文件夹数量、文件数量和作品数量
   * @throws {Error} 当数据库操作失败时抛出错误
   */
  deleteWorkRecursive(workId: number): {
    worksDeleted: number
    foldersDeleted: number
    filesDeleted: number
    worksTagsDeleted: number
    fileVersionsDeleted: number
  } {
    try {
      if (!validateId(workId, '作品ID')) {
        return { worksDeleted: 0, foldersDeleted: 0, filesDeleted: 0, worksTagsDeleted: 0, fileVersionsDeleted: 0 }
      }

      let worksDeleted = 0
      let foldersDeleted = 0
      let filesDeleted = 0
      let worksTagsDeleted = 0
      let fileVersionsDeleted = 0

      this.fileDao.transaction(() => {
        // 1. 获取作品相关的所有文件夹和文件
        const folders = this.folderDao.findByParams({ work_id: workId }).data
        const files = this.fileDao.findByParams({ work_id: workId }).data

        // 2. 先删除文件（包含物理删除）
        const fileDeleteResult = this.deleteFilesWithRelatedData(files)
        filesDeleted += fileDeleteResult.filesDeleted
        fileVersionsDeleted += fileDeleteResult.fileVersionsDeleted

        // 3. 再递归删除文件夹（包含物理删除）
        for (const folder of folders) {
          const folderResult = this.deleteFolderRecursive(folder.id)
          foldersDeleted += folderResult.foldersDeleted
          filesDeleted += folderResult.filesDeleted
        }

        // 4. 删除作品相关的所有标签
        const tagDeleteResult = this.workTagDao.remove(workId)
        worksTagsDeleted += tagDeleteResult

        // 5. 最后删除作品记录
        worksDeleted = this.workDao.delete(workId)
      })

      Logger.debug('递归删除作品完成', {
        workId,
        worksDeleted,
        foldersDeleted,
        filesDeleted,
        worksTagsDeleted,
        fileVersionsDeleted
      })

      return {
        worksDeleted,
        foldersDeleted,
        filesDeleted,
        worksTagsDeleted,
        fileVersionsDeleted
      }
    } catch (error) {
      Logger.error('递归删除作品失败:', { error: String(error), workId })
      throw error
    }
  }

  /**
   * 批量删除文件及其关联数据
   * 私有方法，用于处理文件删除的通用逻辑
   * @param files - 要删除的文件数组
   * @returns 删除结果统计
   */
  private deleteFilesWithRelatedData(files: File[]): {
    filesDeleted: number
    fileVersionsDeleted: number
  } {
    let filesDeleted = 0
    let fileVersionsDeleted = 0

    for (const file of files) {

      // 删除文件版本
      const versionsDeleted = this.fileVersionDao.deleteByFileId(file.id)
      fileVersionsDeleted += versionsDeleted

      // 删除文件记录
      const fileDeleted = this.fileDao.delete(file.id)
      filesDeleted += fileDeleted

      // 删除物理文件
      try {
        if (file.path && require('fs').existsSync(file.path)) {
          require('fs').rmSync(file.path, { recursive: true, force: true })
          Logger.info('物理删除文件成功', { path: file.path })
        }
      } catch (error) {
        Logger.warn('物理删除文件失败:', { error: String(error), path: file.path })
      }
    }

    return { filesDeleted, fileVersionsDeleted }
  }

}
