export interface DownloadOptions {
  url: string;
  destPath: string; // 本地保存路径
  onProgress?: (progress: {
    downloaded: number;
    total: number;
    percent: number;
  }) => void;
  onResume?: () => void; // 断点续传恢复时回调
  retryCount?: number; // 默认 3
  retryDelay?: number; // 默认 2000ms
  timeout?: number; // 下载超时（毫秒），默认 30 分钟
  verifyChecksum?: string; // 可选，下载后校验 SHA256
}

export interface HttpClientConfig {
    baseURL?: string;
    timeout?: number;          // 默认 60000ms
    retryCount?: number;       // 默认 2
    retryDelay?: number;       // 默认 1000ms
    enableLogging?: boolean;   // 默认 true
}