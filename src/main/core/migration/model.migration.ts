import { Migration } from '@/main/types/migration.types'
import { Logger } from '@/main/utils/logger'
import { compareVersions, needsMigration, VersionComparison } from '@/main/utils/version'
import { TimeUtil } from '@/shared/utils'

export class ModelConfigMigration {
  private migrations: Migration[] = []

  constructor() {
    this.registerMigrations()
  }

  private registerMigrations(): void {
    this.addMigration({
      version: '0.1.0',
      description: '初始版本迁移',
      migrate: (config: any) => {
        if (!config.aiProviders) {
          config.aiProviders = []
        }
        if (!config.defaultModels) {
          config.defaultModels = []
        }
        if (!config.providerPriority) {
          config.providerPriority = []
        }
        if (!config.enableAiMode) {
          config.enableAiMode = false
        }
        if (!config.enableCloudAi) {
          config.enableCloudAi = false
        }
        if (!config.version) {
          config.version = '0.1.0'
        }
        if (!config.updatedAt) {
          config.updatedAt = TimeUtil.toISOString(Date.now())
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

    Logger.info('开始执行模型配置迁移', { 
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
    migratedConfig.updatedAt = TimeUtil.toISOString(Date.now())

    Logger.info('模型配置迁移完成', { 
      originalVersion: currentVersion, 
      newVersion: targetVersion 
    })

    return migratedConfig
  }
}

export const modelConfigMigration = new ModelConfigMigration()