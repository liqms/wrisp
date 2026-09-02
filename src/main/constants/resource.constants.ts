/**
 * 远程资源同步常量。
 * 数据源为 GitHub 仓库原始文件（raw.githubusercontent.com），公开仓库匿名访问。
 */
export const RESOURCE_REPO = {
  owner: "liqms",
  repo: "wrisp",
  branch: "main",
  rawBase: "https://raw.githubusercontent.com",
} as const;

export const RESOURCE_CONFIG = {
  resourcesDir: "resources",
  manifestPath: "resources/manifest.json",
  requestTimeout: 15000,
  maxRetries: 2,
  retryDelayMs: 1000,
} as const;
