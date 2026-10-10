import type { DownloadProgress } from "@/main/types/download.types";
import type { ModelManifestEntry } from "@/shared/types/model.types";

/** 单个本地模型在设置页应呈现的状态 */
export type ModelDownloadStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed"
  | "cancelled";

export interface ModelDownloadState {
  status: ModelDownloadStatus;
  progress: number;
}

const BYTES_PER_GB = 1e9;
/** 未判定完成前的进度上限：注册表体积是估值，实际字节超出时也不能提前显示 100% */
const MAX_IN_FLIGHT_PROGRESS = 99;

/**
 * 把一个模型的所有下载记录聚合成单一状态。
 *
 * 判定顺序刻意为「磁盘 > 失败 > 取消 > 全部完成 > 下载中 > 待下载」：
 * 失败必须压过进度，否则一个中断的文件会让该行永远停在某个百分比上。
 */
export function computeModelDownloadState(input: {
  manifest: ModelManifestEntry;
  existsOnDisk: boolean;
  /** 全部分组的下载记录，按时间先后排列 */
  downloads: DownloadProgress[];
}): ModelDownloadState {
  const { manifest, existsOnDisk, downloads } = input;

  if (existsOnDisk) return { status: "completed", progress: 100 };

  // 同一文件重试会产生多条记录，按 remotePath 归并且后到的覆盖先到的
  const latest = new Map<string, DownloadProgress>();
  for (const item of downloads) {
    const file = manifest.files.find((f) => item.url.endsWith(f.remotePath));
    if (file) latest.set(file.remotePath, item);
  }
  if (latest.size === 0) return { status: "pending", progress: 0 };

  const records = Array.from(latest.values());
  const progress = byteProgress(manifest, records);

  if (records.some((r) => r.status === "failed")) return { status: "failed", progress };
  if (records.some((r) => r.status === "cancelled")) return { status: "cancelled", progress };
  if (records.filter((r) => r.status === "completed").length === manifest.files.length) {
    return { status: "completed", progress: 100 };
  }
  return { status: "downloading", progress };
}

/** 按已下载字节 / 模型整体体积计算进度；体积未声明时退回已知的 totalBytes 之和 */
function byteProgress(
  manifest: ModelManifestEntry,
  records: DownloadProgress[],
): number {
  const downloaded = records.reduce((sum, r) => sum + (r.downloadedBytes || 0), 0);
  const expected =
    manifest.sizeGB > 0
      ? manifest.sizeGB * BYTES_PER_GB
      : records.reduce((sum, r) => sum + (r.totalBytes || 0), 0);
  if (expected <= 0) return 0;
  return Math.min(
    MAX_IN_FLIGHT_PROGRESS,
    Math.round((downloaded / expected) * 100),
  );
}
