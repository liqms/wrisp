import { Migration } from '@/main/types/migration.types'
import { Logger } from '@/main/utils/logger'
import { compareVersions, needsMigration, VersionComparison } from '@/main/utils/version'

export class ConfigMigration {
  private migrations: Migration[] = []

  constructor() {
    this.registerMigrations()
  }

  private registerMigrations(): void {
    this.addMigration({
      version: '1.0.0',
      description: '初始版本迁移',
      migrate: (config: any) => {
        if (!config.general) {
          config.general = {}
        }
        if (!config.miniPrograms) {
          config.miniPrograms = []
        }
        if (!config.version) {
          config.version = '1.0.0'
        }
        if (!config.workspace) {
          config.workspace = ''
        }
        if (!config.updatedAt) {
          config.updatedAt = new Date().toISOString()
        }
        return config
      }
    })
  }

  private addMigration(migration: Migration): void {
    this.migrations.push(migration)
    this.migrations.sort((a, b) => compareVersions(a.version, b.version))
  }

  public getMigrationsToExecute(currentVersion: string, targetVersion: string): Migration[] {
    return this.migrations.filter(migration => 
      compareVersions(currentVersion, migration.version) === VersionComparison.OLDER &&
      compareVersions(migration.version, targetVersion) !== VersionComparison.NEWER
    )
  }

  public migrateConfig(config: any, currentVersion: string, targetVersion: string): any {
    if (!needsMigration(currentVersion, targetVersion)) {
      Logger.debug('无需迁移，版本相同或更新', { currentVersion, targetVersion })
      return config
    }

    const migrationsToExecute = this.getMigrationsToExecute(currentVersion, targetVersion)

    if (migrationsToExecute.length === 0) {
      Logger.debug('没有找到需要执行的迁移', { currentVersion, targetVersion })
      return config
    }

    Logger.info('开始执行配置迁移', { 
      currentVersion, 
      targetVersion, 
      migrationCount: migrationsToExecute.length 
    })

    let migratedConfig = { ...config }

    for (const migration of migrationsToExecute) {
      try {
        Logger.debug('执行迁移', { 
          version: migration.version, 
          description: migration.description 
        })
        
        migratedConfig = migration.migrate(migratedConfig)
        migratedConfig.version = migration.version
        
        Logger.debug('迁移完成', { version: migration.version })
      } catch (error) {
        Logger.error('迁移执行失败', {
          version: migration.version,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
        throw error
      }
    }

    migratedConfig.version = targetVersion
    migratedConfig.updatedAt = new Date().toISOString()

    Logger.info('配置迁移完成', { 
      originalVersion: currentVersion, 
      newVersion: targetVersion 
    })

    return migratedConfig
  }

}

export const configMigration = new ConfigMigration()
