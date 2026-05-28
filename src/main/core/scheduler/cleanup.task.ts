import { CleanupService, CleanupResult } from '@/main/core/services/cleanup.service'
import { Logger } from '@/main/utils/logger'

/**
 * 清理配置接口
 */
export interface CleanupConfig {
  /** 是否启用自动清理 */
  enabled: boolean
  /** 清理间隔（小时） */
  intervalHours: number
  /** 是否启用智能清理 */
  enableSmartCleanup: boolean
  /** 是否自动启动 */
  autoStart: boolean
}

/**
 * 清理任务类
 * 负责管理应用的软删除数据清理功能
 */
export class CleanupTask {
  /** 单例实例 */
  private static instance: CleanupTask
  /** 清理服务实例 */
  private cleanupService: CleanupService

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor() {
    this.cleanupService = CleanupService.getInstance()
  }

  /**
   * 获取单例实例
   * @returns CleanupTask 单例实例
   */
  public static getInstance(): CleanupTask {
    if (!CleanupTask.instance) {
      CleanupTask.instance = new CleanupTask()
    }
    return CleanupTask.instance
  }

  /**
   * 手动触发清理
   * @param force - 是否强制清理（跳过智能判断）
   * @returns 清理结果
   */
  async triggerCleanup(force: boolean = false): Promise<CleanupResult> {
    Logger.info('手动触发清理', { force })
    return await this.cleanupService.cleanupSoftDeletedData(30)
  }

  /**
   * 获取软删除数据统计
   * @returns 软删除数据统计信息
   */
  async getSoftDeletedStats() {
    return await this.cleanupService.getSoftDeletedStats()
  }

  /**
   * 获取即将过期的软删除数据统计
   * @param days - 天数
   * @returns 即将过期的统计信息
   */
  async getExpiringSoftDeletedStats(days: number = 7) {
    return await this.cleanupService.getExpiringSoftDeletedStats(days)
  }

  /**
   * 判断是否需要清理
   * @returns 是否需要清理
   */
  async shouldCleanup() {
    const stats = await this.cleanupService.getSoftDeletedStats()
    const total = stats.works + stats.folders + stats.files + stats.tags
    return total > 0
  }

  /**
   * 模拟清理（不实际删除）
   * @returns 清理结果预览
   */
  async dryRun() {
    Logger.info('执行清理预览（dry-run）')
    return await this.cleanupService.getExpiringSoftDeletedStats(30)
  }
}