import { BackupTask } from './backup.task'
import { DEFAULT_BACKUP_CONFIG, DEFAULT_CLEANUP_CONFIG, DEFAULT_LOG_CLEANUP_CONFIG } from '@/main/constants/auto.constants'
import { CleanupTask } from './cleanup.task'
import { Logger } from '@/main/utils/logger'

/**
 * 定时任务调度器
 * 只负责定时调度和任务管理，不处理具体业务逻辑
 * 
 * 职责：
 * - 管理备份任务的定时执行
 * - 管理清理任务的定时执行
 * - 提供启动/停止/重启调度的方法
 */
export class Scheduler {
  /** 单例实例 */
  private static instance: Scheduler
  /** 备份任务实例 */
  private backupTask: BackupTask
  /** 清理任务实例 */
  private cleanupTask: CleanupTask
  /** 备份定时器ID */
  private backupIntervalId: NodeJS.Timeout | null = null
  /** 清理定时器ID */
  private cleanupIntervalId: NodeJS.Timeout | null = null
  /** 日志清理定时器ID */
  private logCleanupIntervalId: NodeJS.Timeout | null = null

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor() {
    this.backupTask = BackupTask.getInstance()
    this.cleanupTask = CleanupTask.getInstance()
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

  // ==================== 备份调度 ====================

  /**
   * 启动备份定时任务
   */
  public startBackupSchedule(): void {
    this.stopBackupSchedule()

    const intervalMs = DEFAULT_BACKUP_CONFIG.backupInterval * 60 * 1000

    Logger.info('启动备份定时任务', {
      intervalMinutes: DEFAULT_BACKUP_CONFIG.backupInterval,
      intervalMs
    })

    this.backupIntervalId = setInterval(async () => {
      await this.backupTask.performBackup()
    }, intervalMs)
  }

  /**
   * 停止备份定时任务
   */
  public stopBackupSchedule(): void {
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId)
      this.backupIntervalId = null
      Logger.info('备份定时任务已停止')
    }
  }

  /**
   * 重启备份定时任务
   */
  public restartBackupSchedule(): void {
    this.startBackupSchedule()
  }

  // ==================== 清理调度 ====================

  /**
   * 启动清理定时任务
   */
  public startCleanupSchedule(): void {
    this.stopCleanupSchedule()

    const intervalMs = DEFAULT_CLEANUP_CONFIG.intervalHours * 60 * 60 * 1000

    Logger.info('启动清理定时任务', {
      intervalHours: DEFAULT_CLEANUP_CONFIG.intervalHours,
      intervalMs
    })

    this.cleanupIntervalId = setInterval(async () => {
      await this.cleanupTask.triggerCleanup()
    }, intervalMs)
  }

  /**
   * 停止清理定时任务
   */
  public stopCleanupSchedule(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
      Logger.info('清理定时任务已停止')
    }
  }

  /**
   * 重启清理定时任务
   */
  public restartCleanupSchedule(): void {
    this.startCleanupSchedule()
  }

  // ==================== 日志清理调度 ====================

  /**
   * 启动日志清理定时任务
   */
  public startLogCleanupSchedule(): void {
    this.stopLogCleanupSchedule()

    const intervalMs = DEFAULT_LOG_CLEANUP_CONFIG.intervalHours * 60 * 60 * 1000

    Logger.info('启动日志清理定时任务', {
      intervalHours: DEFAULT_LOG_CLEANUP_CONFIG.intervalHours,
      keepDays: DEFAULT_LOG_CLEANUP_CONFIG.keepDays,
      intervalMs
    })

    this.logCleanupIntervalId = setInterval(async () => {
      try {
        const deletedCount = await Logger.cleanupOldLogsAsync(DEFAULT_LOG_CLEANUP_CONFIG.keepDays)
        Logger.info('日志清理任务执行完成', {
          deletedCount,
          keepDays: DEFAULT_LOG_CLEANUP_CONFIG.keepDays
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logger.error('日志清理任务执行失败', { error: errorMessage })
      }
    }, intervalMs)
  }

  /**
   * 停止日志清理定时任务
   */
  public stopLogCleanupSchedule(): void {
    if (this.logCleanupIntervalId) {
      clearInterval(this.logCleanupIntervalId)
      this.logCleanupIntervalId = null
      Logger.info('日志清理定时任务已停止')
    }
  }

  /**
   * 重启日志清理定时任务
   */
  public restartLogCleanupSchedule(): void {
    this.startLogCleanupSchedule()
  }

  // ==================== 全局调度 ====================

  /**
   * 启动所有定时任务
   */
  public startAll(): void {
    this.startBackupSchedule()
    this.startCleanupSchedule()
    this.startLogCleanupSchedule()
    Logger.info('所有定时任务已启动')
  }

  /**
   * 停止所有定时任务
   */
  public stopAll(): void {
    this.stopBackupSchedule()
    this.stopCleanupSchedule()
    this.stopLogCleanupSchedule()
    Logger.info('所有定时任务已停止')
  }

  /**
   * 重启所有定时任务
   */
  public restartAll(): void {
    this.stopAll()
    this.startAll()
  }
}