import { autoUpdater } from "electron-updater";
import { Logger } from "@/main/utils/logger";

/** 下载进度信息 */
export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/** 更新事件回调集合 */
export interface UpdateEventHandlers {
  onAvailable?: (info: { version: string; releaseNotes?: string }) => void;
  onDownloadProgress?: (progress: UpdateProgress) => void;
  onDownloaded?: (path: string) => void;
  onError?: (message: string) => void;
}

/**
 * 更新服务（electron-updater + GitHub provider）
 * 提供应用更新检查、下载、安装功能
 */
class UpdateService {
  private static instance: UpdateService;

  private constructor() {
    autoUpdater.logger = Logger;
    // 由用户在检查时主动触发下载，避免自动下载
    autoUpdater.autoDownload = false;
    // electron-updater 默认不自动检查，由"检查更新"按钮显式调用 checkForUpdates() 触发
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /** 注册更新事件处理器（如转发到渲染进程） */
  public onEvents(handlers: UpdateEventHandlers): void {
    if (handlers.onAvailable) {
      autoUpdater.on("update-available", (info) => {
        handlers.onAvailable?.({
          version: info.version,
          releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : "",
        });
      });
    }
    if (handlers.onDownloadProgress) {
      autoUpdater.on("download-progress", (progress) => {
        handlers.onDownloadProgress?.({
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
        });
      });
    }
    if (handlers.onDownloaded) {
      autoUpdater.on("update-downloaded", (info) => {
        handlers.onDownloaded?.(info.path);
      });
    }
    if (handlers.onError) {
      autoUpdater.on("error", (err) => {
        handlers.onError?.(err?.message ?? String(err));
      });
    }
  }

  /**
   * 检查更新。返回是否发现可用更新。
   */
  public async check(): Promise<boolean> {
    try {
      const result = await autoUpdater.checkForUpdates();
      return !!result?.updateInfo;
    } catch (error) {
      Logger.error("检查更新失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 下载更新（autoDownload=false 时需手动调用）
   */
  public async download(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      Logger.error("下载更新失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 安装更新（静默下载完成后调用，Windows/mac 会退出并重启）
   */
  public install(): void {
    autoUpdater.quitAndInstall();
  }
}

export default UpdateService;

export const updateService = UpdateService.getInstance();
