// 基础类型别名（复用file.types.ts中的定义）
type FileVersionId = number
type FileId = number
type FileSize = number
type Timestamp = string

// 文件版本特定类型
type VersionNumber = number
type ChangeDescription = string | null
type BackupPath = string | null

// 高级类型验证工具
type PositiveNumber<T extends number> = T extends 0 ? never : T extends -1 ? never : T
type NonEmptyString<T extends string> = T extends '' ? never : T

// 类型断言工具
type Assert<T, U> = T extends U ? T : never
type Ensure<T, U> = T & U

// 字段约束类型
type ValidVersionNumber = PositiveNumber<number>
type ValidDescription = NonEmptyString<string>

export interface FileVersion {
  id: FileVersionId
  file_id: FileId
  version_number: VersionNumber
  size: FileSize
  change_type: ChangeType
  description: ChangeDescription
  created_at: Timestamp
  backup_path: BackupPath
}

export type ChangeType = 'create' | 'update' | 'move' | 'delete'

// 必填字段
type FileVersionRequiredFields = {
  file_id: FileId
  version_number: VersionNumber
  change_type: ChangeType
}

// 可选字段
type FileVersionOptionalFields = {
  size?: FileSize
  description?: ChangeDescription
  backup_path?: BackupPath
  accessed_at?: Timestamp
}

export interface FileVersionCreate extends FileVersionRequiredFields, FileVersionOptionalFields {
  created_at?: Timestamp
}

export interface FileVersionUpdate extends Partial<FileVersionRequiredFields>, FileVersionOptionalFields { }

// 严格验证的文件版本创建类型
export type StrictFileVersionCreate = Ensure<FileVersionCreate, {
  file_id: FileId
  version_number: ValidVersionNumber
  change_type: ChangeType
}>

// 文件版本查询参数
export interface FileVersionQuery {
  file_id?: FileId
  version_number?: VersionNumber
  change_type?: ChangeType
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

// 文件版本统计信息
export interface FileVersionStats {
  version_count: number
  total_size: FileSize
  average_size: FileSize
  change_types: Record<ChangeType, number>
}


// 示例：使用严格验证的文件版本创建
// const validVersion: StrictFileVersionCreate = {
//   file_id: 1, // 有效的文件ID
//   version_number: 2, // 必须是正数
//   change_type: 'update' // 有效的变更类型
// }

// 示例：无效的文件版本创建（会在编译时报错）
// const invalidVersion: StrictFileVersionCreate = {
//   file_id: 0, // 错误：无效的文件ID
//   version_number: -1, // 错误：负数
//   change_type: 'invalid' // 错误：无效的变更类型
// }
