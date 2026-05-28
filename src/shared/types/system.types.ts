/**
 * 系统接口层类型定义
 */

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
  hostname: string;
  totalMemory: number;
  freeMemory: number;
  cpus: number;
  viewSize: number[];
  locale: string;
}
