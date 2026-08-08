
/**
 * 备份配置接口
 */
export interface BackupConfig {
  /** 是否启用自动备份 */
  autoBackup: boolean
  /** 备份间隔（分钟） */
  backupInterval: number
  /** 最大备份文件数量 */
  maxBackupFiles: number
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  autoBackup: true,
  backupInterval: 30,
  maxBackupFiles: 5,
}

/**
 * 清理配置接口
 */
export interface CleanupConfig {
  /** 是否启用自动清理 */
  enabled: boolean
  /** 清理间隔（小时） */
  intervalHours: number
  /** 默认过期天数 */
  defaultExpirationDays: number
}

export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  enabled: true,
  intervalHours: 24,
  defaultExpirationDays: 30,
}

export interface LogCleanupConfig {
  enabled: boolean
  intervalHours: number
  keepDays: number
}

export const DEFAULT_LOG_CLEANUP_CONFIG: LogCleanupConfig = {
  enabled: true,
  intervalHours: 24,
  keepDays: 30,
}