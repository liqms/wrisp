export type DownloadStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadProgress {
  taskId: string;
  url: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  status: DownloadStatus;
  error?: string;
  localPath?: string;
}

export interface DownloadTask {
  taskId: string;
  url: string;
  subDir: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
  localPath?: string;
  abortController?: AbortController;
}
