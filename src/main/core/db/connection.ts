import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import fs from 'fs'
import { Logger } from '@/main/utils/logger'

/** 数据库连接实例 */
let db: Database.Database | null = null

/**
 * 获取数据库文件路径
 * @returns 数据库文件的完整路径
 */
export function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'database', 'main.db')
}

/**
 * 初始化数据库连接
 * 如果连接已存在则直接返回，否则创建新连接
 * @returns 数据库连接实例
 * @throws {Error} 当数据库连接初始化失败时抛出错误
 */
export function initDatabase(): Database.Database {
  if (db) {
    Logger.debug('数据库连接已存在，直接返回')
    return db
  }

  const dbPath = getDbPath()
  const dbDir = join(dbPath, '..')

  try {
    if (!fs.existsSync(dbDir)) {
      Logger.debug('创建数据库目录:', { dbDir })
      fs.mkdirSync(dbDir, { recursive: true })
    }

    Logger.info('初始化数据库连接:', { dbPath })
    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    })

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    Logger.debug('数据库连接初始化成功')
    return db
  } catch (error) {
    Logger.error('数据库连接初始化失败:', { dbPath: getDbPath(), error: String(error) })
    throw error
  }
}

/**
 * 关闭数据库连接
 * @throws {Error} 当数据库连接关闭失败时抛出错误
 */
export function closeDatabase(): void {
  if (!db) {
    Logger.debug('数据库连接已关闭或未初始化')
    return
  }

  try {
    Logger.debug('正在关闭数据库连接')
    db.close()
    db = null
    Logger.debug('数据库连接关闭成功')
  } catch (error) {
    Logger.error('数据库连接关闭失败:', { dbPath: getDbPath(), error: String(error) })
    throw error
  }
}

/**
 * 检查数据库连接是否有效
 * @returns 连接有效返回 true，否则返回 false
 */
export function isDatabaseConnected(): boolean {
  if (!db) {
    return false
  }

  try {
    db.prepare('SELECT 1').get()
    return true
  } catch {
    return false
  }
}

/**
 * 获取数据库连接实例
 * 如果连接不存在或已断开，会自动初始化或重新连接
 * @returns 数据库连接实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    Logger.debug('数据库连接不存在，正在初始化')
    return initDatabase()
  }

  if (!isDatabaseConnected()) {
    Logger.debug('数据库连接已断开，重新连接')
    db = null
    return initDatabase()
  }

  return db
}
