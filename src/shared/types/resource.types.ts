import type { ResourceType } from "@/shared/enums/resource.enums";

/** manifest.json 中单个文件条目 */
export interface ManifestEntry {
  type: ResourceType;
  /** 相对 resources/ 的路径，如 "slash/todo.json" */
  path: string;
  /** 单文件语义化版本，如 "1.0.0" */
  version: string;
  /** 文件内容 SHA256 hash（hex） */
  sha256: string;
}

/** resources/manifest.json 顶层结构 */
export interface RemoteManifest {
  /** manifest 整体版本（任意文件变更时递增） */
  version: string;
  /** 远程清单更新时间（ISO 8601） */
  updatedAt: string;
  /** 文件条目列表 */
  files: ManifestEntry[];
}

/** 本地工作区缓存的 manifest（与 RemoteManifest 结构一致） */
export type LocalManifest = RemoteManifest;

/** 同步状态 */
export interface SyncStatus {
  syncing: boolean;
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  lastError: string | null;
}

/** 单次同步结果 */
export interface SyncResult {
  success: boolean;
  /** 本次同步涉及的资源类型（用于渲染层定向刷新） */
  changedTypes: ResourceType[];
  added: string[];
  updated: string[];
  error?: string;
}

export const EMPTY_SYNC_STATUS: SyncStatus = {
  syncing: false,
  lastSyncAt: null,
  lastSyncSuccess: false,
  lastError: null,
};
