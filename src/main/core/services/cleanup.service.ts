import * as fs from 'fs'
import * as path from 'path'
import { getDatabase, getDbPath } from '@/main/core/db/connection'
import { Logger } from '@/main/utils/logger'
import { TimeUtil } from '@/shared/utils'

/**
 * 清理结果接口
 */
export interface CleanupResult {
  /** 清理的语义块数量 */
  semanticChunksDeleted: number
  /** 清理的主题数量 */
  topicsDeleted: number
  /** 清理的作品数量 */
  projectsDeleted: number
  /** 清理的页面数量 */
  pagesDeleted: number
  /** 清理的反思数量 */
  reflectionsDeleted: number
  /** 清理的文件索引数量 */
  fileIndexDeleted: number
  /** 清理的标签关联数量 */
  taggedItemsDeleted: number
  /** 清理的过期任务数量 */
  tasksDeleted: number
  /** 清理的过期 Skill 执行记录数量 */
  skillExecutionsDeleted: number
  /** 物理删除的文件数量 */
  filesPhysicallyDeleted: number
  /** 是否成功 */
  success: boolean
  /** 错误信息（如果失败） */
  error?: string
}

/**
 * 数据库清理服务类
 * 用于清理软删除的数据（status = 'deleted'）和过期记录
 *
 * v2 架构清理策略：
 * - semantic_chunks (status = 'deleted') → 级联清理关联表 + FTS
 * - topics (status = 'deleted') → 级联清理关联表 + FTS
 * - projects (status = 'deleted') → 级联清理关联表 + FTS + 子 pages
 * - pages (status = 'deleted') → 清理 FTS
 * - reflections (status = 'deleted') → 清理关联表
 * - file_index (sync_status = 'deleted') → 物理删除文件
 * - tasks (终端状态) → 直接删除
 * - skill_executions (过期) → 直接删除
 */
export class CleanupService {
  /** 单例实例 */
  private static instance: CleanupService

  /** 默认保留天数 */
  private readonly defaultRetentionDays: number = 30

  /** 任务默认保留天数 */
  private readonly taskRetentionDays: number = 7

  /** Skill 执行记录默认保留天数 */
  private readonly skillExecutionRetentionDays: number = 90

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor() { }

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
   * 获取工作空间路径（从数据库路径推导）
   * dbPath = {workspace}/sqlite/pentip.db
   * @returns 工作空间绝对路径
   */
  private getWorkspacePath(): string {
    const dbPath = getDbPath()
    return path.dirname(path.dirname(dbPath))
  }

  /**
   * 异步物理删除文件
   * @param targetPath - 要删除的路径（相对于 workspace 的相对路径）
   * @returns 是否删除成功
   */
  private async physicallyDelete(targetPath: string): Promise<boolean> {
    try {
      if (!targetPath || targetPath.trim() === '') {
        return false
      }

      const workspacePath = this.getWorkspacePath()
      const absolutePath = path.join(workspacePath, targetPath)
      const normalizedPath = path.normalize(absolutePath)

      if (!normalizedPath.startsWith(workspacePath)) {
        Logger.warn('跳过非工作空间目录的路径', { path: targetPath })
        return false
      }

      if (!fs.existsSync(normalizedPath)) {
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
      const totalDeleted = result.stats.semanticChunksDeleted + result.stats.topicsDeleted +
        result.stats.projectsDeleted + result.stats.pagesDeleted + result.stats.reflectionsDeleted +
        result.stats.fileIndexDeleted + result.stats.taggedItemsDeleted +
        result.stats.tasksDeleted + result.stats.skillExecutionsDeleted

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
        semanticChunksDeleted: 0,
        topicsDeleted: 0,
        projectsDeleted: 0,
        pagesDeleted: 0,
        reflectionsDeleted: 0,
        fileIndexDeleted: 0,
        taggedItemsDeleted: 0,
        tasksDeleted: 0,
        skillExecutionsDeleted: 0,
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
  private doCleanup(retentionDays: number): {
    stats: Omit<CleanupResult, 'success' | 'error' | 'filesPhysicallyDeleted'>
    deletedPaths: string[]
  } {
    const expireTimestamp = this.getExpireTimestamp(retentionDays)
    const taskExpireTimestamp = this.getExpireTimestamp(this.taskRetentionDays)
    const skillExecExpireTimestamp = this.getExpireTimestamp(this.skillExecutionRetentionDays)
    const deletedPaths: string[] = []
    const stats = {
      semanticChunksDeleted: 0,
      topicsDeleted: 0,
      projectsDeleted: 0,
      pagesDeleted: 0,
      reflectionsDeleted: 0,
      fileIndexDeleted: 0,
      taggedItemsDeleted: 0,
      tasksDeleted: 0,
      skillExecutionsDeleted: 0
    }

    // 1. 清理软删除的 semantic_chunks
    const deletedChunksSql = `SELECT id FROM semantic_chunks WHERE status = 'deleted' AND updated_at < ?`
    const deletedChunks = this.db.prepare(deletedChunksSql).all(expireTimestamp) as { id: string }[]
    const chunkIds = deletedChunks.map(c => c.id)

    if (chunkIds.length > 0) {
      const placeholders = chunkIds.map(() => '?').join(', ')

      // 清理关联表
      this.db.prepare(`DELETE FROM semantic_chunks_fts WHERE rowid IN (SELECT rowid FROM semantic_chunks WHERE id IN (${placeholders}))`).run(...chunkIds)
      this.db.prepare(`DELETE FROM semantic_links WHERE source_chunk_id IN (${placeholders}) OR target_chunk_id IN (${placeholders})`).run(...chunkIds, ...chunkIds)
      this.db.prepare(`DELETE FROM concept_chunks WHERE chunk_id IN (${placeholders})`).run(...chunkIds)
      this.db.prepare(`DELETE FROM topic_chunks WHERE chunk_id IN (${placeholders})`).run(...chunkIds)
      this.db.prepare(`DELETE FROM  project_chunks WHERE chunk_id IN (${placeholders})`).run(...chunkIds)
      this.db.prepare(`DELETE FROM reflection_chunks WHERE chunk_id IN (${placeholders})`).run(...chunkIds)
      this.db.prepare(`DELETE FROM temporal_events WHERE chunk_id IN (${placeholders})`).run(...chunkIds)
      const taggedResult = this.db.prepare(`DELETE FROM tagged_items WHERE entity_type = 'semantic_chunks' AND entity_id IN (${placeholders})`).run(...chunkIds)
      stats.taggedItemsDeleted += taggedResult.changes

      // 删除 semantic_chunks
      const deleteChunksStmt = this.db.prepare(`DELETE FROM semantic_chunks WHERE id IN (${placeholders})`)
      stats.semanticChunksDeleted = deleteChunksStmt.run(...chunkIds).changes
    }

    // 2. 清理软删除的 topics
    const deletedTopicsSql = `SELECT id FROM topics WHERE status = 'deleted' AND updated_at < ?`
    const deletedTopics = this.db.prepare(deletedTopicsSql).all(expireTimestamp) as { id: string }[]
    const topicIds = deletedTopics.map(t => t.id)

    if (topicIds.length > 0) {
      const placeholders = topicIds.map(() => '?').join(', ')

      this.db.prepare(`DELETE FROM topics_fts WHERE rowid IN (SELECT rowid FROM topics WHERE id IN (${placeholders}))`).run(...topicIds)
      this.db.prepare(`DELETE FROM topic_chunks WHERE topic_id IN (${placeholders})`).run(...topicIds)
      this.db.prepare(`DELETE FROM topic_concepts WHERE topic_id IN (${placeholders})`).run(...topicIds)

      const deleteTopicsStmt = this.db.prepare(`DELETE FROM topics WHERE id IN (${placeholders})`)
      stats.topicsDeleted = deleteTopicsStmt.run(...topicIds).changes
    }

    // 3. 清理软删除的 projects（级联清理关联的 pages）
    const deletedProjectsSql = `SELECT id FROM projects WHERE status = 'deleted' AND updated_at < ?`
    const deletedProjects = this.db.prepare(deletedProjectsSql).all(expireTimestamp) as { id: string }[]
    const projectIds = deletedProjects.map(p => p.id)

    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(', ')

      // 清理 project 关联的 pages 和 pages_fts
      const projectPages = this.db.prepare(`SELECT id FROM pages WHERE project_id IN (${placeholders})`).all(...projectIds) as { id: string }[]
      const pageIds = projectPages.map(p => p.id)
      if (pageIds.length > 0) {
        const pagePlaceholders = pageIds.map(() => '?').join(', ')
        this.db.prepare(`DELETE FROM pages_fts WHERE rowid IN (SELECT rowid FROM pages WHERE id IN (${pagePlaceholders}))`).run(...pageIds)
        this.db.prepare(`DELETE FROM pages WHERE id IN (${pagePlaceholders})`).run(...pageIds)
      }

      this.db.prepare(`DELETE FROM projects_fts WHERE rowid IN (SELECT rowid FROM projects WHERE id IN (${placeholders}))`).run(...projectIds)
      this.db.prepare(`DELETE FROM  project_chunks WHERE project_id IN (${placeholders})`).run(...projectIds)

      const deleteProjectsStmt = this.db.prepare(`DELETE FROM projects WHERE id IN (${placeholders})`)
      stats.projectsDeleted = deleteProjectsStmt.run(...projectIds).changes
    }

    // 4. 清理软删除的 pages（孤立页面，不属于已删除的 project）
    const deletedPagesSql = `SELECT id FROM pages WHERE status = 'deleted' AND updated_at < ? AND project_id NOT IN (SELECT id FROM projects WHERE status = 'deleted')`
    const deletedPages = this.db.prepare(deletedPagesSql).all(expireTimestamp) as { id: string }[]
    const pageIds = deletedPages.map(p => p.id)

    if (pageIds.length > 0) {
      const placeholders = pageIds.map(() => '?').join(', ')
      this.db.prepare(`DELETE FROM pages_fts WHERE rowid IN (SELECT rowid FROM pages WHERE id IN (${placeholders}))`).run(...pageIds)
      const deletePagesStmt = this.db.prepare(`DELETE FROM pages WHERE id IN (${placeholders})`)
      stats.pagesDeleted = deletePagesStmt.run(...pageIds).changes
    }

    // 5. 清理软删除的 reflections
    const deletedReflectionsSql = `SELECT id FROM reflections WHERE status = 'deleted' AND updated_at < ?`
    const deletedReflections = this.db.prepare(deletedReflectionsSql).all(expireTimestamp) as { id: string }[]
    const reflectionIds = deletedReflections.map(r => r.id)

    if (reflectionIds.length > 0) {
      const placeholders = reflectionIds.map(() => '?').join(', ')
      this.db.prepare(`DELETE FROM reflection_chunks WHERE reflection_id IN (${placeholders})`).run(...reflectionIds)
      const deleteReflectionsStmt = this.db.prepare(`DELETE FROM reflections WHERE id IN (${placeholders})`)
      stats.reflectionsDeleted = deleteReflectionsStmt.run(...reflectionIds).changes
    }

    // 6. 清理 file_index（sync_status = 'deleted'），收集文件路径用于物理删除
    const deletedFileIndexSql = `SELECT file_path FROM file_index WHERE sync_status = 'deleted' AND updated_at < ?`
    const deletedFiles = this.db.prepare(deletedFileIndexSql).all(expireTimestamp) as { file_path: string }[]
    for (const file of deletedFiles) {
      if (file.file_path) {
        deletedPaths.push(file.file_path)
      }
    }

    const deleteFileIndexStmt = this.db.prepare(`DELETE FROM file_index WHERE sync_status = 'deleted' AND updated_at < ?`)
    stats.fileIndexDeleted = deleteFileIndexStmt.run(expireTimestamp).changes

    // 7. 清理过期的任务记录（终端状态）
    const deleteTasksStmt = this.db.prepare(
      `DELETE FROM tasks WHERE status IN ('succeeded', 'failed', 'cancelled') AND updated_at < ?`
    )
    stats.tasksDeleted = deleteTasksStmt.run(taskExpireTimestamp).changes

    // 8. 清理过期的 Skill 执行记录
    const deleteSkillExecStmt = this.db.prepare(
      `DELETE FROM skill_executions WHERE created_at < ?`
    )
    stats.skillExecutionsDeleted = deleteSkillExecStmt.run(skillExecExpireTimestamp).changes

    return { stats, deletedPaths }
  }

  /**
   * 获取软删除数据统计信息
   * @returns 统计结果
   */
  public getSoftDeletedStats(): {
    semanticChunks: number
    topics: number
    projects: number
    pages: number
    reflections: number
    fileIndex: number
  } {
    try {
      const stats = {
        semanticChunks: (this.db.prepare("SELECT COUNT(*) as count FROM semantic_chunks WHERE status = 'deleted'").get() as { count: number }).count,
        topics: (this.db.prepare("SELECT COUNT(*) as count FROM topics WHERE status = 'deleted'").get() as { count: number }).count,
        projects: (this.db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'deleted'").get() as { count: number }).count,
        pages: (this.db.prepare("SELECT COUNT(*) as count FROM pages WHERE status = 'deleted'").get() as { count: number }).count,
        reflections: (this.db.prepare("SELECT COUNT(*) as count FROM reflections WHERE status = 'deleted'").get() as { count: number }).count,
        fileIndex: (this.db.prepare("SELECT COUNT(*) as count FROM file_index WHERE sync_status = 'deleted'").get() as { count: number }).count
      }

      Logger.debug('获取软删除数据统计完成', stats)
      return stats
    } catch (error) {
      Logger.error('获取软删除数据统计失败', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return { semanticChunks: 0, topics: 0, projects: 0, pages: 0, reflections: 0, fileIndex: 0 }
    }
  }

  /**
   * 获取即将过期的软删除数据统计（即将在指定天数内过期）
   * @param days - 天数
   * @returns 统计结果
   */
  public getExpiringSoftDeletedStats(days: number = 7): {
    semanticChunks: number
    topics: number
    projects: number
    pages: number
    reflections: number
    fileIndex: number
  } {
    try {
      const expireTimestamp = this.getExpireTimestamp(days)
      const stats = {
        semanticChunks: (this.db.prepare("SELECT COUNT(*) as count FROM semantic_chunks WHERE status = 'deleted' AND updated_at < ?").get(expireTimestamp) as { count: number }).count,
        topics: (this.db.prepare("SELECT COUNT(*) as count FROM topics WHERE status = 'deleted' AND updated_at < ?").get(expireTimestamp) as { count: number }).count,
        projects: (this.db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'deleted' AND updated_at < ?").get(expireTimestamp) as { count: number }).count,
        pages: (this.db.prepare("SELECT COUNT(*) as count FROM pages WHERE status = 'deleted' AND updated_at < ?").get(expireTimestamp) as { count: number }).count,
        reflections: (this.db.prepare("SELECT COUNT(*) as count FROM reflections WHERE status = 'deleted' AND updated_at < ?").get(expireTimestamp) as { count: number }).count,
        fileIndex: (this.db.prepare("SELECT COUNT(*) as count FROM file_index WHERE sync_status = 'deleted' AND updated_at < ?").get(expireTimestamp) as { count: number }).count
      }

      Logger.debug('获取即将过期的软删除数据统计完成', { days, stats })
      return stats
    } catch (error) {
      Logger.error('获取即将过期的软删除数据统计失败', {
        error: error instanceof Error ? error.message : String(error),
        days,
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return { semanticChunks: 0, topics: 0, projects: 0, pages: 0, reflections: 0, fileIndex: 0 }
    }
  }
}