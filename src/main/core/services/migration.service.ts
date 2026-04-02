import { Migration, VersionComparison } from '@/main/types/migration.types'
import { Logger } from '@/main/utils/logger'

/**
 * 版本迁移服务
 * 负责处理配置文件的版本升级和迁移
 */
class MigrationService {
  private static instance: MigrationService | null = null
  private migrations: Migration[] = []

  private constructor() {
    this.registerMigrations()
  }

  /**
   * 获取 MigrationService 的单例实例
   */
  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService()
    }
    return MigrationService.instance
  }

  /**
   * 注册所有迁移函数
   */
  private registerMigrations(): void {
    // 从 0.0.0 到 1.0.0 的迁移
    this.addMigration({
      version: '1.0.0',
      description: '初始版本迁移',
      migrate: (config: any) => {
        // 确保所有必需的字段都存在
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

    // 可以继续添加更多迁移
    // this.addMigration({
    //   version: '1.1.0',
    //   description: '添加新功能配置',
    //   migrate: (config: any) => {
    //     // 迁移逻辑
    //     return config
    //   }
    // })
  }

  /**
   * 添加迁移函数
   */
  private addMigration(migration: Migration): void {
    this.migrations.push(migration)
    this.migrations.sort((a, b) => this.compareVersions(a.version, b.version))
  }

  /**
   * 比较两个版本号
   * @param version1 版本号1
   * @param version2 版本号2
   * @returns 比较结果
   */
  public compareVersions(version1: string, version2: string): VersionComparison {
    const v1 = version1.split('.').map(Number)
    const v2 = version2.split('.').map(Number)

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0
      const num2 = v2[i] || 0

      if (num1 < num2) return VersionComparison.OLDER
      if (num1 > num2) return VersionComparison.NEWER
    }

    return VersionComparison.EQUAL
  }

  /**
   * 检查是否需要迁移
   * @param currentVersion 当前版本
   * @param targetVersion 目标版本
   * @returns 是否需要迁移
   */
  public needsMigration(currentVersion: string, targetVersion: string): boolean {
    return this.compareVersions(currentVersion, targetVersion) === VersionComparison.OLDER
  }

  /**
   * 获取需要执行的迁移列表
   * @param currentVersion 当前版本
   * @param targetVersion 目标版本
   * @returns 需要执行的迁移列表
   */
  public getMigrationsToExecute(currentVersion: string, targetVersion: string): Migration[] {
    return this.migrations.filter(migration => 
      this.compareVersions(currentVersion, migration.version) === VersionComparison.OLDER &&
      this.compareVersions(migration.version, targetVersion) !== VersionComparison.NEWER
    )
  }

  /**
   * 执行配置迁移
   * @param config 当前配置
   * @param currentVersion 当前版本
   * @param targetVersion 目标版本
   * @returns 迁移后的配置
   */
  public migrateConfig(config: any, currentVersion: string, targetVersion: string): any {
    if (!this.needsMigration(currentVersion, targetVersion)) {
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

    // 更新到目标版本
    migratedConfig.version = targetVersion
    migratedConfig.updatedAt = new Date().toISOString()

    Logger.info('配置迁移完成', { 
      originalVersion: currentVersion, 
      newVersion: targetVersion 
    })

    return migratedConfig
  }

  /**
   * 获取当前应用的版本号
   * @returns 应用版本号
   */
  public getAppVersion(): string {
    // 从环境变量或 package.json 读取版本号
    if (process.env.APP_VERSION) {
      return process.env.APP_VERSION
    }    
    return '0.0.0'
  }
}

export default MigrationService
export const migrationService = MigrationService.getInstance()