import { BaseDao } from './base.dao'
import { MigrationDb, MigrationDbCreate, MigrationDbUpdate, MigrationStatus } from '@/main/types/db'  
import { validateId, validateString } from '@/shared/utils/validate'

/**
 * 数据库迁移数据访问对象
 * 提供数据库迁移记录相关的数据库操作方法
 */
export class MigrationDbDao extends BaseDao<MigrationDb, MigrationDbCreate, MigrationDbUpdate> {
  /**
   * 构造函数
   * 初始化数据库迁移 DAO，指定表名为 'migrations_db'
   */
  constructor() {
    super('migrations_db', { 
      enabled: true,
      createdAtField: 'created_at',
      updatedAtField: 'updated_at'
    })
  }

  /**
   * 根据条件查询迁移记录列表
   * @param params - 查询条件对象
   * @returns 符合条件的迁移记录列表
   */
  queryByParams(params: Partial<{
    version?: string | null
    status?: MigrationStatus
  }>): MigrationDb[] {
    let sql = 'SELECT * FROM migrations_db WHERE 1=1'
    const values: unknown[] = []

    if (params.version && validateString(params.version, '版本号')) {
      sql += ' AND version = ?'
      values.push(params.version)
    }
    if (params.status !== undefined) {
      sql += ' AND status = ?'
      values.push(params.status)
    }

    sql += ' ORDER BY version ASC'
    return super.query(sql, values)
  }

  /**
   * 查找最新的迁移记录
   * @returns 最新的迁移记录对象，未找到时返回 null
   */
  findLatestMigration(): MigrationDb | null {
    const sql = 'SELECT * FROM migrations_db ORDER BY created_at DESC LIMIT 1'
    return super.queryOne(sql)
  }

  /**
   * 查找所有待执行的迁移记录
   * @returns 待执行的迁移记录列表
   */
  findPendingMigrations(): MigrationDb[] {
    return super.query('SELECT * FROM migrations_db WHERE status = 0 ORDER BY version ASC')
  }

  /**
   * 标记迁移为已执行
   * @param id - 迁移记录 ID
   * @param executionTime - 执行耗时（毫秒）
   * @returns 受影响的行数
   */
  markAsExecuted(id: number, executionTime: number): number {
    if (!validateId(id, '迁移ID')) return 0
    const sql = 'UPDATE migrations_db SET status = 1, executed_at = CURRENT_TIMESTAMP, execution_time = ? WHERE id = ?'
    return super.execute(sql, [executionTime, id]).changes
  }

  /**
   * 标记迁移为执行失败
   * @param id - 迁移记录 ID
   * @param errorMessage - 错误信息
   * @returns 受影响的行数
   */
  markAsFailed(id: number, errorMessage: string): number {
    if (!validateId(id, '迁移ID')) return 0
    const sql = 'UPDATE migrations_db SET status = 2, error_message = ? WHERE id = ?'
    return super.execute(sql, [errorMessage, id]).changes
  }

  /**
   * 获取当前数据库版本号
   * @returns 最新已执行迁移的版本号，无记录时返回 null
   */
  getCurrentVersion(): string | null {
    const sql = 'SELECT version FROM migrations_db WHERE status = 1 ORDER BY executed_at DESC LIMIT 1'
    const result = super.queryOne(sql) as unknown as { version?: string }
    return result?.version || null
  }
}
