// 数据库类型定义导出文件
// 此文件导出所有数据库相关的类型定义

// 基础类型导出
export * from './file.types'
export * from './fileVersion.types'
export * from './folder.types'
export * from './work.types'
export * from './workTag.types'
export * from './migrationDb.types'

// 通用类型工具（从file.types.ts中导出）
export type {
  FileId,
  FolderId,
  WorkId,
  Timestamp,
  FilePath,
  FileExtension,
  FileSize,
  HashValue,
  NonEmptyString,
  PositiveNumber,
  ValidFilePath,
  Assert,
  Ensure
} from './file.types'


// 统计信息类型别名（从各自文件中导出）
export type { FileStatus } from './file.types'
export type { FolderStatus } from './folder.types'
export type { WorkStatus } from './work.types'
export type { MigrationStatus } from './migrationDb.types'

// 严格验证类型别名（从各自文件中导出）
export type { StrictFileCreate } from './file.types'
export type { StrictFileVersionCreate } from './fileVersion.types'
export type { StrictFolderCreate } from './folder.types'
export type { StrictWorkCreate } from './work.types'
export type { StrictWorkTagCreate } from './workTag.types'
export type { StrictMigrationDbCreate } from './migrationDb.types'
