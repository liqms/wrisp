import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '@/main/core/db/connection'
import { Logger } from '@/main/utils/logger'
import { app } from 'electron'
import { TimeUtil } from '@/shared/utils'

/**
 * 清理结果接口
 */
export interface CleanupResult {
  /** 清理的作品数量 */
  worksDeleted: number
  /** 清理的文件夹数量 */
  foldersDeleted: number
  /** 清理的文件数量 */
  filesDeleted: number
  /** 清理的标签数量 */
  tagsDeleted: number
  /** 物理删除的文件/文件夹数量 */
  filesPhysicallyDeleted: number
  /** 是否成功 */
  success: boolean
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * 数据库清理服务类
 * 用于清理软删除的数据（status = 0）
 */
export class CleanupService {
  /** 单例实例 */
  private static instance: CleanupService

  /** 默认保留天数 */
  private readonly defaultRetentionDays: number = 30

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor() {}

  /**
   * 获取单例实例
   * @returns CleanupService 单例实例
   */
  public static getInstance(): CleanupService {
    if (!CleanupService.instance) {
      CleanupService.instance = new CleanupService()
    }
    return CleanupService.instance
  }

  /**
   * 获取数据库连接
   * @returns 数据库实例
   */
  private get db() {
    return getDatabase()
  }

  /**
   * 获取过期时间戳
   * @param days - 保留天数，默认30天
   * @returns ISO 8601 格式的过期时间字符串
   */
  private getExpireTimestamp(days: number = this.defaultRetentionDays): string {
    const expireDate = new Date()
    expireDate.setDate(expireDate.getDate() - days)
    return expireDate.toISOString()
  }

  /**
   * 异步物理删除文件或文件夹
   * @param targetPath - 要删除的路径
   * @returns 是否删除成功
   */
  private async physicallyDelete(targetPath: string): Promise<boolean> {
    try {
      if (!targetPath || targetPath.trim() === '') {
        return false
      }

      const normalizedPath = path.normalize(targetPath)
      const userDataPath = app.getPath('userData')
      const normalizedUserData = path.normalize(userDataPath)

      if (!normalizedPath.startsWith(normalizedUserData)) {
        Logger.warn('跳过非用户数据目录的路径', { path: targetPath })
        return false
      }

      await fs.promises.rm(normalizedPath, { recursive: true, force: true })
      return true
    } catch (error) {
      Logger.debug('物理删除失败', {
        path: targetPath,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * 清理软删除的数据
   * @param retentionDays - 保留天数，默认30天
   * @returns 清理结果
   */
  public async cleanupSoftDeletedData(retentionDays: number = this.defaultRetentionDays): Promise<CleanupResult> {
    const startTime = Date.now()
    Logger.info('开始清理软删除数据', {
      retentionDays,
      timestamp: TimeUtil.toISOString(startTime)
    })

    try {
      const result = await this.db.transaction(() => {
        return this.doCleanup(retentionDays)
      })()

      const physicallyDeletedCount = await this.deletePhysicalFiles(result.deletedPaths)

      const duration = Date.now() - startTime
      const totalDeleted = result.stats.worksDeleted + result.stats.foldersDeleted + result.stats.filesDeleted + result.stats.tagsDeleted

      Logger.info('软删除数据清理完成', {
        ...result.stats,
        filesPhysicallyDeleted: physicallyDeletedCount,
        totalDeleted,
        duration: `${duration}ms`,
        timestamp: TimeUtil.toISOString(Date.now())
      })

      return {
        ...result.stats,
        filesPhysicallyDeleted: physicallyDeletedCount,
        success: true
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      Logger.error('软删除数据清理失败', {
        error: errorMsg,
        retentionDays,
        timestamp: TimeUtil.toISOString(Date.now())
      })

      return {
        worksDeleted: 0,
        foldersDeleted: 0,
        filesDeleted: 0,
        tagsDeleted: 0,
        filesPhysicallyDeleted: 0,
        success: false,
        error: errorMsg
      }
    }
  }

  /**
   * 物理删除文件
   * @param paths - 要删除的路径数组
   * @returns 成功删除的数量
   */
  private async deletePhysicalFiles(paths: string[]): Promise<number> {
    let deletedCount = 0
    for (const p of paths) {
      if (p && p.trim() !== '') {
        const success = await this.physicallyDelete(p)
        if (success) {
          deletedCount++
        }
      }
    }
    return deletedCount
  }

  /**
   * 执行实际的清理操作
   * @param retentionDays - 保留天数
   * @returns 清理统计结果和待删除的路径
   */
  private doCleanup(retentionDays: number): { stats: Omit<CleanupResult, 'success' | 'error' | 'filesPhysicallyDeleted'>; deletedPaths: string[] } {
    const expireTimestamp = this.getExpireTimestamp(retentionDays)
    const deletedPaths: string[] = []
    const stats = {
      worksDeleted: 0,
      foldersDeleted: 0,
      filesDeleted: 0,
      tagsDeleted: 0
    }

    // 1. 获取所有需要清理的作品ID及其路径
    const deletedWorksSql = `SELECT id, path, full_path FROM works WHERE status = 'deleted' AND updated_at < ?`
    const deletedWorkRecords = this.db.prepare(deletedWorksSql).all(expireTimestamp) as { id: number; path: string; full_path: string }[]
    const workIds = deletedWorkRecords.map(w => w.id)

    // 收集作品路径用于物理删除
    for (const work of deletedWorkRecords) {
      if (work.path) deletedPaths.push(work.path)
      if (work.full_path) deletedPaths.push(work.full_path)
    }

    if (workIds.length > 0) {
      // 2. 获取作品关联的文件路径（用于物理删除）
      const filesOfWorksSql = `SELECT path, full_path FROM files WHERE work_id IN (${workIds.map(() => '?').join(', ')})`
      const filesOfWorks = this.db.prepare(filesOfWorksSql).all(workIds) as { path: string; full_path: string }[]
      for (const file of filesOfWorks) {
        if (file.path) deletedPaths.push(file.path)
        if (file.full_path) deletedPaths.push(file.full_path)
      }

      // 3. 获取作品关联的文件夹路径（用于物理删除）
      const foldersOfWorksSql = `SELECT path, full_path FROM folders WHERE work_id IN (${workIds.map(() => '?').join(', ')})`
      const foldersOfWorks = this.db.prepare(foldersOfWorksSql).all(workIds) as { path: string; full_path: string }[]
      for (const folder of foldersOfWorks) {
        if (folder.path) deletedPaths.push(folder.path)
        if (folder.full_path) deletedPaths.push(folder.full_path)
      }

      // 4. 删除作品关联的标签
      const deleteTagsStmt = this.db.prepare(
        `DELETE FROM work_tags WHERE work_id IN (${workIds.map(() => '?').join(', ')})`
      )
      stats.tagsDeleted = deleteTagsStmt.run(workIds).changes

      // 5. 删除作品（级联删除会自动删除关联的文件夹和文件）
      const deleteWorksStmt = this.db.prepare(
        `DELETE FROM works WHERE id IN (${workIds.map(() => '?').join(', ')})`
      )
      stats.worksDeleted = deleteWorksStmt.run(workIds).changes
    }

    // 7. 删除不属于任何作品的孤立文件夹（status = 0）
    const orphanFoldersSql = `SELECT path, full_path FROM folders WHERE status = 0 AND updated_at < ? AND work_id = 0`
    const orphanFolders = this.db.prepare(orphanFoldersSql).all(expireTimestamp) as { path: string; full_path: string }[]
    for (const folder of orphanFolders) {
      if (folder.path) deletedPaths.push(folder.path)
      if (folder.full_path) deletedPaths.push(folder.full_path)
    }

    const deleteOrphanFoldersStmt = this.db.prepare(
      `DELETE FROM folders WHERE status = 0 AND updated_at < ? AND work_id = 0`
    )
    stats.foldersDeleted = deleteOrphanFoldersStmt.run(expireTimestamp).changes

    // 8. 删除不属于任何作品和文件夹的孤立文件（status = 0）
    const orphanFilesSql = `SELECT path, full_path FROM files WHERE status = 0 AND updated_at < ? AND work_id = 0 AND folder_id = 0`
    const orphanFiles = this.db.prepare(orphanFilesSql).all(expireTimestamp) as { path: string; full_path: string }[]
    for (const file of orphanFiles) {
      if (file.path) deletedPaths.push(file.path)
      if (file.full_path) deletedPaths.push(file.full_path)
    }

    const deleteOrphanFilesStmt = this.db.prepare(
      `DELETE FROM files WHERE status = 0 AND updated_at < ? AND work_id = 0 AND folder_id = 0`
    )
    stats.filesDeleted = deleteOrphanFilesStmt.run(expireTimestamp).changes

    return { stats, deletedPaths }
  }

  /**
   * 获取软删除数据统计信息
   * @returns 统计结果
   */
  public getSoftDeletedStats(): {
    works: number
    folders: number
    files: number
    tags: number
  } {
    try {
      const stats = {
        works: (this.db.prepare('SELECT COUNT(*) as count FROM works WHERE status = 0').get() as { count: number }).count,
        folders: (this.db.prepare('SELECT COUNT(*) as count FROM folders WHERE status = 0').get() as { count: number }).count,
        files: (this.db.prepare('SELECT COUNT(*) as count FROM files WHERE status = 0').get() as { count: number }).count,
        tags: (this.db.prepare(`
          SELECT COUNT(*) as count FROM work_tags 
          WHERE work_id IN (SELECT id FROM works WHERE status = 0)
        `).get() as { count: number }).count
      }

      Logger.debug('获取软删除数据统计完成', stats)
      return stats
    } catch (error) {
      Logger.error('获取软删除数据统计失败', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return { works: 0, folders: 0, files: 0, tags: 0 }
    }
  }

  /**
   * 获取即将过期的软删除数据统计（即将在指定天数内过期）
   * @param days - 天数
   * @returns 统计结果
   */
  public getExpiringSoftDeletedStats(days: number = 7): {
    works: number
    folders: number
    files: number
    tags: number
  } {
    try {
      const expireTimestamp = this.getExpireTimestamp(days)
      const stats = {
        works: (this.db.prepare('SELECT COUNT(*) as count FROM works WHERE status = 0 AND updated_at < ?').get(expireTimestamp) as { count: number }).count,
        folders: (this.db.prepare('SELECT COUNT(*) as count FROM folders WHERE status = 0 AND updated_at < ?').get(expireTimestamp) as { count: number }).count,
        files: (this.db.prepare('SELECT COUNT(*) as count FROM files WHERE status = 0 AND updated_at < ?').get(expireTimestamp) as { count: number }).count,
        tags: (this.db.prepare(`
          SELECT COUNT(*) as count FROM work_tags 
          WHERE work_id IN (SELECT id FROM works WHERE status = 0 AND updated_at < ?)
        `).get(expireTimestamp) as { count: number }).count
      }

      Logger.debug('获取即将过期的软删除数据统计完成', { days, stats })
      return stats
    } catch (error) {
      Logger.error('获取即将过期的软删除数据统计失败', {
        error: error instanceof Error ? error.message : String(error),
        days,
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return { works: 0, folders: 0, files: 0, tags: 0 }
    }
  }
}