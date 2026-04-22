// 基础类型别名（复用file.types.ts中的定义）
type MigrationId = number
type Timestamp = string

// 数据库迁移特定类型
type VersionString = string
type MigrationName = string
type MigrationDescription = string | null
type SqlStatement = string
type ExecutionTime = number | null
type Checksum = string | null
type ErrorMessage = string | null

// 高级类型验证工具
type NonEmptyString<T extends string> = T extends '' ? never : T
type PositiveNumber<T extends number> = T extends 0 ? never : T extends -1 ? never : T

// 类型断言工具
type Assert<T, U> = T extends U ? T : never
type Ensure<T, U> = T & U

// 字段约束类型
type ValidVersionString = NonEmptyString<string>
type ValidMigrationName = NonEmptyString<string>
type ValidSqlStatement = NonEmptyString<string>
type ValidExecutionTime = PositiveNumber<number>

export interface MigrationDb {
  id: MigrationId
  version: VersionString
  name: MigrationName
  description: MigrationDescription
  sql_statement: SqlStatement
  status: MigrationStatus
  executed_at: Timestamp | null
  execution_time: ExecutionTime
  checksum: Checksum
  error_message: ErrorMessage
  created_at: Timestamp
}

export type MigrationStatus = 0 | 1 | 2

// 必填字段
type MigrationDbRequiredFields = {
  version: VersionString
  name: MigrationName
  sql_statement: SqlStatement
}

// 可选字段
type MigrationDbOptionalFields = {
  description?: MigrationDescription
  checksum?: Checksum
  status?: MigrationStatus
}

export interface MigrationDbCreate extends MigrationDbRequiredFields, MigrationDbOptionalFields {}

export interface MigrationDbUpdate extends Partial<MigrationDbRequiredFields>, MigrationDbOptionalFields {
  executed_at?: Timestamp
  execution_time?: ExecutionTime
  error_message?: ErrorMessage
}

// 严格验证的数据库迁移创建类型
export type StrictMigrationDbCreate = Ensure<MigrationDbCreate, {
  version: ValidVersionString
  name: ValidMigrationName
  sql_statement: ValidSqlStatement
  execution_time: ValidExecutionTime
}>

// 迁移执行历史
export interface MigrationHistory {
  id: MigrationId
  version: VersionString
  name: MigrationName
  status: MigrationStatus
  executed_at: Timestamp | null
  execution_time: ExecutionTime
  error_message: ErrorMessage
}

// 示例：使用严格验证的数据库迁移创建
// const validMigration: StrictMigrationDbCreate = {
//   version: '1.0.0', // 必须是非空字符串
//   name: 'create_users_table', // 必须是非空字符串
//   sql_statement: 'CREATE TABLE users (id INT PRIMARY KEY)', // 必须是非空字符串
//   execution_time: 100 // 必须是正数
// }

// 示例：无效的数据库迁移创建（会在编译时报错）
// const invalidMigration: StrictMigrationDbCreate = {
//   version: '', // 错误：空字符串
//   name: '', // 错误：空字符串
//   sql_statement: '', // 错误：空SQL语句
//   execution_time: -1 // 错误：负数
// }
