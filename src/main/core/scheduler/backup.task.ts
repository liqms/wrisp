import { app } from 'electron'
import path from 'path'
import * as fs from 'fs'
import { Logger } from '@/main/utils/logger'
import { TimeUtil } from '@/shared/utils'

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

/**
 * 备份文件信息接口
 */
export interface BackupFileInfo {
  /** 文件名 */
  name: string
  /** 文件路径 */
  path: string
  /** 修改时间 */
  time: number
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true })
  } catch {
    // ignore error
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.promises.cp(src, dest, { recursive: true })
}

async function copyFile(src: string, dest: string): Promise<void> {
  const destDir = path.dirname(dest)
  await ensureDir(destDir)
  await fs.promises.copyFile(src, dest)
}

/**
 * 备份任务类
 * 负责管理应用的自动备份和手动备份功能
 */
export class BackupTask {
  /** 单例实例 */
  private static instance: BackupTask
  /** 用户数据路径 */
  private userDataPath: string
  /** 备份文件路径 */
  private backupsPath: string
  /** 备份定时器ID */
  private backupIntervalId: NodeJS.Timeout | null = null

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor() {
    this.userDataPath = app.getPath('userData')
    this.backupsPath = path.join(this.userDataPath, 'backups')
    this.initBackupsPath()
  }

  /**
   * 获取单例实例
   * @returns BackupTask 单例实例
   */
  public static getInstance(): BackupTask {
    if (!BackupTask.instance) {
      BackupTask.instance = new BackupTask()
    }
    return BackupTask.instance
  }

  /**
   * 初始化备份文件夹
   * @private
   */
  private async initBackupsPath(): Promise<void> {
    try {
      await ensureDir(this.backupsPath)
      Logger.debug('备份文件夹初始化成功', { backupsPath: this.backupsPath })
    } catch (error) {
      Logger.error('备份文件夹初始化失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
    }
  }

  /**
   * 获取备份配置
   * @returns 备份配置对象
   * @private
   */
  private getConfig(): BackupConfig {
    return {
      autoBackup: true,
      backupInterval: 10,
      maxBackupFiles: 10
    }
  }

  /**
   * 生成备份文件名
   * @returns 备份文件名
   * @private
   */
  private generateBackupFilename(): string {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')
    return `backup_${timestamp}.zip`
  }

  /**
   * 获取需要备份的文件列表
   * @returns 文件路径和目标路径的映射数组
   * @private
   */
  private async getFilesToBackup(): Promise<{ source: string; dest: string }[]> {
    const filesToBackup: { source: string; dest: string }[] = []

    // 添加配置文件夹
    const configPath = path.join(this.userDataPath, 'config')
    if (await pathExists(configPath)) {
      filesToBackup.push({
        source: configPath,
        dest: 'config'
      })
    }

    // 添加数据库文件
    const databasesPath = path.join(this.userDataPath, 'databases')
    if (await pathExists(databasesPath)) {
      const dbFiles = await fs.promises.readdir(databasesPath)
      for (const file of dbFiles) {
        if (file.endsWith('.db') || file.endsWith('.sqlite')) {
          filesToBackup.push({
            source: path.join(databasesPath, file),
            dest: file
          })
        }
      }
    }

    return filesToBackup
  }

  /**
   * 创建备份压缩包
   * @param backupPath 备份文件路径
   * @param filesToBackup 需要备份的文件列表
   * @returns Promise<string> 备份文件路径
   * @private
   */
  private async createBackupArchive(backupPath: string, filesToBackup: { source: string; dest: string }[]): Promise<string> {
    const tempDir = path.join(this.backupsPath, 'temp')
    await ensureDir(tempDir)

    // 复制文件到临时目录
    for (const { source, dest } of filesToBackup) {
      const tempDest = path.join(tempDir, dest)
      const stat = await fs.promises.stat(source)
      if (stat.isDirectory()) {
        await copyDir(source, tempDest)
      } else {
        await copyFile(source, tempDest)
      }
    }

    // 创建压缩包
    const archiver = require('archiver')
    const output = fs.createWriteStream(backupPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolve, reject) => {
      output.on('close', async () => {
        try {
          await removeDir(tempDir)
          resolve(backupPath)
        } catch (err) {
          reject(err)
        }
      })

      archive.on('error', (err: Error) => {
        removeDir(tempDir).catch(() => { })
        reject(err)
      })

      archive.pipe(output)
      archive.directory(tempDir, false)
      archive.finalize()
    })
  }

  /**
   * 创建备份文件
   * @returns 备份文件路径，如果失败则返回 null
   * @private
   */
  private async createBackup(): Promise<string | null> {
    const startTime = Date.now()
    try {
      const backupFilename = this.generateBackupFilename()
      const backupPath = path.join(this.backupsPath, backupFilename)

      // 获取需要备份的文件列表
      const filesToBackup = await this.getFilesToBackup()

      if (filesToBackup.length === 0) {
        Logger.debug('没有需要备份的文件')
        return null
      }

      // 创建备份压缩包
      const resultPath = await this.createBackupArchive(backupPath, filesToBackup)

      // 记录成功信息
      const duration = Date.now() - startTime
      const stats = await fs.promises.stat(backupPath)
      Logger.info('备份创建成功', {
        backupPath,
        size: stats.size,
        duration: `${duration}ms`
      })

      return resultPath
    } catch (error) {
      Logger.error('备份创建失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })
      return null
    }
  }

  /**
   * 清理旧备份文件
   * 删除超过最大备份数量的旧文件
   * @private
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const config = this.getConfig()
      const files = await fs.promises.readdir(this.backupsPath)

      const backupFiles: BackupFileInfo[] = files
        .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(this.backupsPath, file),
          time: fs.statSync(path.join(this.backupsPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      if (backupFiles.length > config.maxBackupFiles) {
        const filesToDelete = backupFiles.slice(config.maxBackupFiles)
        for (const file of filesToDelete) {
          await removeDir(file.path)
          Logger.debug('旧备份文件删除成功', { file: file.name })
        }
        Logger.info('旧备份文件清理完成', { deleted: filesToDelete.length })
      }
    } catch (error) {
      Logger.error('旧备份文件清理失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
    }
  }

  /**
   * 执行备份操作
   * @returns 备份是否成功
   */
  public async performBackup(): Promise<boolean> {
    try {
      const backupPath = await this.createBackup()
      if (backupPath) {
        await this.cleanupOldBackups()
        return true
      }
      return false
    } catch (error) {
      Logger.error('备份失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return false
    }
  }

  /**
   * 启动自动备份计划
   * @private
   */
  private startSchedule(): void {
    this.stopSchedule()

    const intervalMinutes = 10
    const intervalMs = intervalMinutes * 60 * 1000

    Logger.info('开始备份计划', {
      intervalMinutes,
      intervalMs
    })

    this.backupIntervalId = setInterval(async () => {
      await this.performBackup()
    }, intervalMs)

    Logger.info('备份计划已启动（每10分钟执行一次）')
  }

  /**
   * 停止自动备份计划
   * @private
   */
  private stopSchedule(): void {
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId)
      this.backupIntervalId = null
      Logger.info('备份计划已停止')
    }
  }

  /**
   * 重启备份计划
   * 停止当前计划并根据配置重新启动
   */
  public restartSchedule(): void {
    this.startSchedule()
  }

  /**
   * 获取备份文件列表
   * @returns 备份文件信息数组，按时间降序排列
   */
  public async getBackupList(): Promise<BackupFileInfo[]> {
    try {
      const files = await fs.promises.readdir(this.backupsPath)

      const backupFiles: BackupFileInfo[] = files
        .filter(file => file.startsWith('backup_') && file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(this.backupsPath, file),
          time: fs.statSync(path.join(this.backupsPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      return backupFiles
    } catch (error) {
      Logger.error('获取备份列表失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return []
    }
  }

  /**
   * 获取备份文件路径
   * @param filename 备份文件名
   * @returns 备份文件的完整路径
   */
  public getBackupPath(filename: string): string {
    return path.join(this.backupsPath, filename)
  }

  /**
   * 删除备份文件
   * @param filename 备份文件名
   * @returns 删除是否成功
   */
  public async deleteBackup(filename: string): Promise<boolean> {
    try {
      const backupPath = this.getBackupPath(filename)
      await removeDir(backupPath)
      Logger.info('备份文件删除成功', { filename })
      return true
    } catch (error) {
      Logger.error('删除备份失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        filename: filename,
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return false
    }
  }

  /**
   * 验证备份文件是否完整
   * @param filename 备份文件名
   * @returns 验证结果
   */
  public async validateBackup(filename: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const backupPath = this.getBackupPath(filename)

      // 检查文件是否存在
      if (!(await pathExists(backupPath))) {
        return { valid: false, error: '备份文件不存在' }
      }

      // 检查文件大小
      const stats = await fs.promises.stat(backupPath)
      if (stats.size === 0) {
        return { valid: false, error: '备份文件为空' }
      }

      // 尝试读取ZIP文件头部
      const fileDescriptor = fs.openSync(backupPath, 'r')
      const buffer = Buffer.allocUnsafe(4)
      fs.readSync(fileDescriptor, buffer, 0, 4, 0)
      fs.closeSync(fileDescriptor)

      // 检查ZIP文件魔数 (0x50 0x4B 后面跟着 0x03/0x05/0x07)
      const isZip = buffer[0] === 0x50 &&
        buffer[1] === 0x4B &&
        (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)

      if (!isZip) {
        return { valid: false, error: '备份文件格式无效' }
      }

      return { valid: true }
    } catch (error) {
      Logger.error('备份文件验证失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        filename: filename,
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return { valid: false, error: '验证过程中发生错误' }
    }
  }
}