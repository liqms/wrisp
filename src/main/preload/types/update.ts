/** 下载进度（由主进程转发） */
export interface UpdateProgressPayload {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/** 更新域暴露给渲染进程的 API */
export interface UpdateAPI {
  /** 检查更新，返回是否发现可用更新 */
  check(): Promise<boolean>;
  /** 下载更新 */
  download(): Promise<void>;
  /** 安装更新 */
  install(): void;
  /** 订阅更新事件 */
  onEvent(
    event: "available" | "download-progress" | "downloaded" | "error",
    listener: (payload: any) => void,
  ): void;
}
