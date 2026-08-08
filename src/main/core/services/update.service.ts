import { autoUpdater } from "electron-updater";
import { Logger } from "@/main/utils/logger";

/**
 * 更新服务
 * 提供应用更新检查、下载、安装功能
 */
class UpdateService {
  private static instance: UpdateService;

  private constructor() {
    autoUpdater.logger = Logger;
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * 检查更新
   */
  public async check(): Promise<any> {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result;
    } catch (error) {
      Logger.error("检查更新失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 下载更新
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
   * 安装更新
   */
  public install(): void {
    autoUpdater.quitAndInstall();
  }
}

export default UpdateService;

export const updateService = UpdateService.getInstance();