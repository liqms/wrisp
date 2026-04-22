
export enum VersionComparison {
  OLDER = -1,
  EQUAL = 0,
  NEWER = 1
}

/**
 * 比较两个版本号
 * @param version1 版本号1
 * @param version2 版本号2
 * @returns 比较结果
 */
export function compareVersions(version1: string, version2: string): VersionComparison {
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
export function needsMigration(currentVersion: string, targetVersion: string): boolean {
  return compareVersions(currentVersion, targetVersion) === VersionComparison.OLDER
}

/**
 * 获取应用版本号
 * @returns 应用版本号
 */
export function getAppVersion(): string {
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION
  }
  return '0.0.0'
}
