import { VersionString, Description } from "@/shared/types"

/**
 * 配置迁移函数类型
 */
export type MigrationFunction = (config: Record<string, unknown>) => Record<string, unknown>

/**
 * 迁移描述接口
 */
export interface Migration {
  version: VersionString
  description: Description
  migrate: MigrationFunction
}

/**
 * 版本比较结果
 */
export enum VersionComparison {
  OLDER = -1,
  EQUAL = 0,
  NEWER = 1
}