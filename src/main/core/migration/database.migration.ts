import { Logger } from '@/main/utils/logger'
import { getDatabase, getDbPath } from '@/main/core/db/connection'
import { MigrationDbDao } from '@/main/core/db/migrationDb.dao'
import fs from 'fs'
import { join } from 'path'
import { compareVersions, VersionComparison } from '@/main/utils/version'

export class DatabaseMigration {
  private static instance: DatabaseMigration | null = null
  private migrationDbDao: MigrationDbDao

  private constructor() {
    this.migrationDbDao = new MigrationDbDao()
  }

  public static getInstance(): DatabaseMigration {
    if (!DatabaseMigration.instance) {
      DatabaseMigration.instance = new DatabaseMigration()
    }
    return DatabaseMigration.instance
  }

  private getSchemaFilePath(): string {
    const isProduction = process.env.NODE_ENV === 'production'
    let basePath = __dirname
    
    if (isProduction) {
      basePath = join(basePath, '..', 'schemas')
    } else {
      basePath = join(basePath, 'schemas')
    }
    
    return join(basePath, 'init.sql')
  }

  public initDatabaseSchema(): boolean {
    try {
      Logger.info('开始初始化数据库表结构')
      
      const db = getDatabase()
      const schemaPath = this.getSchemaFilePath()

      if (!fs.existsSync(schemaPath)) {
        Logger.error('数据库初始化脚本不存在:', { dbPath: getDbPath(), schemaPath })
        throw new Error(`数据库初始化脚本不存在: ${schemaPath}`)
      }

      const sqlContent = fs.readFileSync(schemaPath, 'utf-8')
      
      db.exec(sqlContent)
      
      Logger.info('数据库表结构初始化成功')
      return true
    } catch (error) {
      Logger.error('数据库表结构初始化失败:', { dbPath: getDbPath(), error: String(error) })
      throw error
    }
  }

  public isDatabaseInitialized(): boolean {
    try {
      const db = getDatabase()
      
      const result = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='folders'
      `).get()

      return result !== undefined
    } catch (error) {
      Logger.error('检查数据库初始化状态失败:', { dbPath: getDbPath(), error: String(error) })
      return false
    }
  }

  public getDatabaseVersion(): string | null {
    try {
      return this.migrationDbDao.getCurrentVersion()
    } catch (error) {
      Logger.error('获取数据库版本失败:', { dbPath: getDbPath(), error: String(error) })
      return null
    }
  }

  public executeDatabaseMigration(targetVersion: string = '1.0.0'): boolean {
    try {
      const currentVersion = this.getDatabaseVersion()
      
      if (!currentVersion) {
        Logger.info('数据库尚未初始化，执行初始化')
        this.initDatabaseSchema()
        return true
      }

      if (compareVersions(currentVersion, targetVersion) === VersionComparison.NEWER) {
        Logger.warn('当前数据库版本高于目标版本', { currentVersion, targetVersion })
        return false
      }

      if (compareVersions(currentVersion, targetVersion) === VersionComparison.EQUAL) {
        Logger.info('数据库版本已为目标版本', { currentVersion })
        return false
      }

      Logger.info('开始执行数据库迁移', { currentVersion, targetVersion })

      const pendingMigrations = this.migrationDbDao.findPendingMigrations()
      
      for (const migration of pendingMigrations) {
        if (compareVersions(migration.version, targetVersion) === VersionComparison.NEWER) {
          continue
        }

        try {
          Logger.debug('执行数据库迁移', { version: migration.version })
          
          const db = getDatabase()
          const startTime = Date.now()
          
          db.exec(migration.sql_statement)
          
          const executionTime = Date.now() - startTime
          this.migrationDbDao.markAsExecuted(migration.id, executionTime)
          
          Logger.debug('数据库迁移完成', { version: migration.version, executionTime })
        } catch (error) {
          this.migrationDbDao.markAsFailed(migration.id, error instanceof Error ? error.message : String(error))
          throw error
        }
      }

      Logger.info('数据库迁移完成', { currentVersion, targetVersion })
      return true
    } catch (error) {
      Logger.error('数据库迁移失败:', { dbPath: getDbPath(), error: String(error) })
      throw error
    }
  }
}

export const databaseMigration = DatabaseMigration.getInstance()
