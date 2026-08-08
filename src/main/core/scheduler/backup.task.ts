import { app } from 'electron'
import path from 'path'
import * as fs from 'fs'
import { Logger } from '@/main/utils/logger'
import { TimeUtil } from '@/shared/utils'
import { BACKUPS_DIR, CONFIG_DIR} from '@/main/constants'
import { getDbPath } from '@/main/core/db/connection'
import { configService } from '@/main/core/services/config.service'
import { BackupConfig } from '@/main/constants/auto.constants'

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
 * 只负责执行备份操作，不管理调度逻辑
 * 
 * 备份策略：
 * - 应用配置文件和模型配置文件 → userData/backups/
 * - SQL 数据库文件 → workspace/backups/
 */
export class BackupTask {
  /** 单例实例 */
  private static instance: BackupTask
  /** 用户数据路径 */
  private userDataPath: string
  /** 应用备份文件路径 (userData/backups/) */
  private appBackupsPath: string
  /** 数据库备份文件路径 (workspace/backups/) */
  private dbBackupsPath: string

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor() {
    this.userDataPath = app.getPath('userData')
    this.appBackupsPath = path.join(this.userDataPath, BACKUPS_DIR)
    this.dbBackupsPath = path.join(configService.getValue('workspace') || '', BACKUPS_DIR)
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
      await ensureDir(this.appBackupsPath)
      Logger.debug('备份文件夹初始化成功', { appBackupsPath: this.appBackupsPath })
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
      maxBackupFiles: 5
    }
  }

  /**
   * 生成备份文件名
   * @param prefix - 备份文件前缀（区分应用备份和数据库备份）
   * @returns 备份文件名
   * @private
   */
  private generateBackupFilename(prefix: string = 'backup'): string {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-')
    return `${prefix}_${timestamp}.zip`
  }

  /**
   * 获取需要备份的应用配置文件和模型配置文件列表
   * @returns 文件路径和目标路径的映射数组
   * @private
   */
  private async getFilesToBackup(): Promise<{ source: string; dest: string }[]> {
    const filesToBackup: { source: string; dest: string }[] = []

    // 添加配置文件夹（包含应用配置和模型配置）
    const configPath = path.join(this.userDataPath, CONFIG_DIR)
    if (await pathExists(configPath)) {
      filesToBackup.push({
        source: configPath,
        dest: CONFIG_DIR
      })
    }

    return filesToBackup
  }

  /**
   * 获取需要备份的数据库文件列表
   * @returns 文件路径和目标路径的映射数组
   * @private
   */
  private async getDatabaseFilesToBackup(): Promise<{ source: string; dest: string }[]> {
    const filesToBackup: { source: string; dest: string }[] = []

    try {
      const dbPath = getDbPath()
      const dbDir = path.dirname(dbPath)

      if (await pathExists(dbDir)) {
        const dbFiles = await fs.promises.readdir(dbDir)
        for (const file of dbFiles) {
          if (file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.sqlite-wal') || file.endsWith('.sqlite-shm')) {
            filesToBackup.push({
              source: path.join(dbDir, file),
              dest: file
            })
          }
        }
      }
    } catch (error) {
      Logger.warn('获取数据库文件列表失败', {
        cause: error instanceof Error ? error.message : String(error)
      })
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
    const tempDir = path.join(path.dirname(backupPath), 'temp')
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
   * 创建应用配置备份
   * @returns 备份文件路径，如果失败则返回 null
   * @private
   */
  private async createAppConfigBackup(): Promise<string | null> {
    const startTime = Date.now()
    try {
      const backupFilename = this.generateBackupFilename('config')
      const backupPath = path.join(this.appBackupsPath, backupFilename)

      // 获取需要备份的应用配置文件列表
      const filesToBackup = await this.getFilesToBackup()

      if (filesToBackup.length === 0) {
        Logger.debug('没有需要备份的应用配置文件')
        return null
      }

      // 创建备份压缩包
      const resultPath = await this.createBackupArchive(backupPath, filesToBackup)

      // 记录成功信息
      const duration = Date.now() - startTime
      const stats = await fs.promises.stat(backupPath)
      Logger.info('应用配置备份创建成功', {
        backupPath,
        size: stats.size,
        duration: `${duration}ms`
      })

      return resultPath
    } catch (error) {
      Logger.error('应用配置备份创建失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })
      return null
    }
  }

  /**
   * 创建数据库备份
   * @returns 备份文件路径，如果失败则返回 null
   * @private
   */
  private async createDatabaseBackup(): Promise<string | null> {
    const startTime = Date.now()
    try {

      // 初始化数据库备份目录
      await ensureDir(this.dbBackupsPath)

      const backupFilename = this.generateBackupFilename('sqlite')
      const backupPath = path.join(this.dbBackupsPath, backupFilename)

      // 获取需要备份的数据库文件列表
      const filesToBackup = await this.getDatabaseFilesToBackup()

      if (filesToBackup.length === 0) {
        Logger.debug('没有需要备份的数据库文件')
        return null
      }

      // 创建备份压缩包
      const resultPath = await this.createBackupArchive(backupPath, filesToBackup)

      // 记录成功信息
      const duration = Date.now() - startTime
      const stats = await fs.promises.stat(backupPath)
      Logger.info('数据库备份创建成功', {
        backupPath,
        size: stats.size,
        duration: `${duration}ms`
      })

      return resultPath
    } catch (error) {
      Logger.error('数据库备份创建失败', {
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
   * @param backupDir - 备份目录路径
   * @param prefix - 备份文件前缀
   * @private
   */
  private async cleanupOldBackups(backupDir: string, prefix: string = 'backup'): Promise<void> {
    try {
      const config = this.getConfig()
      const files = await fs.promises.readdir(backupDir)

      const backupFiles: BackupFileInfo[] = files
        .filter(file => file.startsWith(`${prefix}_`) && file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
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
      let success = false

      // 创建应用配置备份
      const appBackupPath = await this.createAppConfigBackup()
      if (appBackupPath) {
        await this.cleanupOldBackups(this.appBackupsPath, 'config')
        success = true
      }

      // 创建数据库备份
      const dbBackupPath = await this.createDatabaseBackup()
      if (dbBackupPath) {
        // 获取数据库备份目录路径
        await this.cleanupOldBackups(this.dbBackupsPath, 'sqlite')
        success = true
      }

      return success
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
   * 获取应用配置备份文件列表
   * @returns 备份文件信息数组，按时间降序排列
   */
  public async getAppBackupList(): Promise<BackupFileInfo[]> {
    try {
      const files = await fs.promises.readdir(this.appBackupsPath)

      const backupFiles: BackupFileInfo[] = files
        .filter(file => file.startsWith('config_') && file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(this.appBackupsPath, file),
          time: fs.statSync(path.join(this.appBackupsPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      return backupFiles
    } catch (error) {
      Logger.error('获取应用配置备份列表失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return []
    }
  }

  /**
   * 获取数据库备份文件列表
   * @returns 备份文件信息数组，按时间降序排列
   */
  public async getDatabaseBackupList(): Promise<BackupFileInfo[]> {
    try {
      if (!(await pathExists(this.dbBackupsPath))) {
        return []
      }

      const files = await fs.promises.readdir(this.dbBackupsPath)

      const backupFiles: BackupFileInfo[] = files
        .filter(file => file.startsWith('database_') && file.endsWith('.zip'))
        .map(file => ({
          name: file,
          path: path.join(this.dbBackupsPath, file),
          time: fs.statSync(path.join(this.dbBackupsPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      return backupFiles
    } catch (error) {
      Logger.error('获取数据库备份列表失败', {
        path: 'main/core/scheduler/backup.task.ts',
        cause: error instanceof Error ? error.message : String(error),
        timestamp: TimeUtil.toISOString(Date.now())
      })
      return []
    }
  }

  /**
   * 获取备份文件路径
   * @param type - 备份类型（'config' 或 'sqlite'）
   * @param filename - 备份文件名
   * @returns 备份文件的完整路径
   */
  public getBackupPath(type: 'config' | 'sqlite', filename: string): string {
    if (type === 'config') {
      return path.join(this.appBackupsPath, filename)
    } else {
      return path.join(this.dbBackupsPath, filename)
    }
  }

  /**
   * 删除备份文件
   * @param type - 备份类型（'config' 或 'sqlite'）
   * @param filename - 备份文件名
   * @returns 删除是否成功
   */
  public async deleteBackup(type: 'config' | 'sqlite', filename: string): Promise<boolean> {
    try {
      const backupPath = this.getBackupPath(type, filename)
      await removeDir(backupPath)
      Logger.info('备份文件删除成功', { type, filename })
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
   * @param type - 备份类型（'config' 或 'sqlite'）
   * @param filename - 备份文件名
   * @returns 验证结果
   */
  public async validateBackup(type: 'config' | 'sqlite', filename: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const backupPath = this.getBackupPath(type, filename)

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