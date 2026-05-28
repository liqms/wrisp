import { BackupTask, BackupFileInfo } from './backup.task'
import { CleanupTask } from './cleanup.task'
import { Logger } from '@/main/utils/logger'
import type { CleanupResult } from '@/main/core/services/cleanup.service'

/**
 * 任务调度器类
 * 负责管理应用的各种计划任务，包括备份任务和清理任务
 */
export class Scheduler {
  /** 单例实例 */
  private static instance: Scheduler
  /** 备份任务实例 */
  private backupTask: BackupTask
  /** 清理任务实例 */
  private cleanupTask: CleanupTask
  /** 清理定时器ID */
  private cleanupIntervalId: NodeJS.Timeout | null = null

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor() {
    this.backupTask = BackupTask.getInstance()
    this.cleanupTask = CleanupTask.getInstance()
    this.init()
  }

  /**
   * 获取单例实例
   * @returns Scheduler 单例实例
   */
  public static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler()
    }
    return Scheduler.instance
  }

  /**
   * 初始化调度器
   * 启动备份任务和清理任务并设置配置变更监听
   * @private
   */
  private init(): void {
    try {
      this.startBackupTask()
      this.startCleanupTask()
    } catch (error) {
      Logger.error('计划任务初始化失败', {
        path: 'main/core/scheduler/scheduler.ts',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private startBackupTask(): void {
    try {
      this.backupTask.restartSchedule()
      Logger.info('备份任务启动完成')
    } catch (error) {
      Logger.error('备份任务启动失败', {
        path: 'main/core/scheduler/scheduler.ts',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private startCleanupTask(): void {
    try {
      this.stopCleanupTask()

      const intervalHours = 24
      const intervalMs = intervalHours * 60 * 60 * 1000

      Logger.info('开始清理计划', {
        intervalHours,
        intervalMs
      })

      this.cleanupIntervalId = setInterval(async () => {
        await this.executeScheduledCleanup()
      }, intervalMs)

      Logger.info('清理计划已启动（每24小时执行一次）')
    } catch (error) {
      Logger.error('清理任务启动失败', {
        path: 'main/core/scheduler/scheduler.ts',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private stopCleanupTask(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
      Logger.info('清理计划已停止')
    }
  }

  private async executeScheduledCleanup(): Promise<void> {
    try {
      Logger.info('开始执行定期清理任务')
      const result = await this.cleanupTask.triggerCleanup()
      Logger.info('定期清理任务完成', {
        worksDeleted: result.worksDeleted,
        foldersDeleted: result.foldersDeleted,
        filesDeleted: result.filesDeleted,
        tagsDeleted: result.tagsDeleted,
        filesPhysicallyDeleted: result.filesPhysicallyDeleted,
        success: result.success
      })
    } catch (error) {
      Logger.error('定期清理任务失败', {
        path: 'main/core/scheduler/scheduler.ts',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * 手动启动计划任务
   */
  public start(): void {
    this.startBackupTask()
    this.startCleanupTask()
  }

  /**
   * 手动触发备份
   * @returns 备份是否成功
   */
  public triggerBackupNow(): Promise<boolean> {
    return this.backupTask.performBackup()
  }

  /**
   * 手动触发清理
   * @param force - 是否强制清理（跳过智能判断）
   * @returns 清理结果
   */
  public async triggerCleanupNow(force: boolean = false): Promise<CleanupResult> {
    return await this.cleanupTask.triggerCleanup(force)
  }

  /**
   * 获取软删除数据统计
   * @returns 软删除数据统计信息
   */
  public async getSoftDeletedStats() {
    return await this.cleanupTask.getSoftDeletedStats()
  }

  /**
   * 判断是否需要清理
   * @returns 是否需要清理
   */
  public async shouldCleanup() {
    return await this.cleanupTask.shouldCleanup()
  }

  /**
   * 清理预览（不实际删除）
   * @returns 清理结果预览
   */
  public async cleanupDryRun() {
    return await this.cleanupTask.dryRun()
  }

  /**
   * 获取备份文件列表
   * @returns 备份文件信息数组，按时间降序排列
   */
  public async getBackupList(): Promise<BackupFileInfo[]> {
    return await this.backupTask.getBackupList()
  }

  /**
   * 获取备份文件路径
   * @param filename 备份文件名
   * @returns 备份文件的完整路径
   */
  public getBackupPath(filename: string): string {
    return this.backupTask.getBackupPath(filename)
  }

  /**
   * 删除备份文件
   * @param filename 备份文件名
   * @returns 删除是否成功
   */
  public deleteBackup(filename: string): Promise<boolean> {
    return this.backupTask.deleteBackup(filename)
  }

  /**
   * 验证备份文件是否完整
   * @param filename 备份文件名
   * @returns 验证结果
   */
  public async validateBackup(filename: string): Promise<{ valid: boolean; error?: string }> {
    return await this.backupTask.validateBackup(filename)
  }
}
