import {
  app,
  Notification,
  OpenDialogOptions,
  OpenDialogReturnValue,
  dialog,
  screen,
  nativeTheme,
} from "electron";
import os from "os";
import { Logger } from "@/main/utils/logger";
import { SystemInfo, NotificationLevel } from "@/shared/types";

/**
 * 系统服务
 * 提供系统级功能调用，包括系统信息获取、系统通知、文件对话框等
 * 注意：此类服务处理操作系统级别的功能，不同于应用内通信
 */
class SystemService {
  private static instance: SystemService;

  /**
   * 私有构造函数
   * 防止外部实例化
   */
  private constructor() {}

  /**
   * 获取 SystemService 的单例实例
   * @returns SystemService 单例实例
   */
  public static getInstance(): SystemService {
    if (!SystemService.instance) {
      SystemService.instance = new SystemService();
    }
    return SystemService.instance;
  }

  /**
   * 获取系统信息
   * 收集操作系统、应用和硬件相关信息
   * @returns 系统信息对象，包含平台、架构、版本、内存、CPU 和屏幕尺寸等信息
   */
  public getSystemInfo(): SystemInfo {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    // locale 去掉中间连字符 -
    const locale = app.getLocale().replace("-", "") || "zhCN";

    try {
      const systemInfo: SystemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        appVersion: app.getVersion(),
        hostname: os.hostname(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length,
        viewSize: [width, height],
        locale,
      };
      return systemInfo;
    } catch (error) {
      Logger.error("获取系统信息失败", { error });
      return {
        platform: "unknown",
        arch: "unknown",
        nodeVersion: "unknown",
        electronVersion: "unknown",
        appVersion: "unknown",
        hostname: "unknown",
        totalMemory: 0,
        freeMemory: 0,
        cpus: 0,
        viewSize: [0, 0],
        locale,
      };
    }
  }

  /**
   * 显示系统级桌面通知
   * 使用操作系统原生通知功能显示桌面通知
   * 注意：此类通知是操作系统级别的，不同于应用内通知
   * @param level - 通知级别（info、success、warning、error）
   * @param title - 通知标题
   * @param body - 通知内容
   */
  public showSystemNotification(
    level: NotificationLevel,
    title: string,
    body: string,
  ): void {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({ title, body });
        notification.show();
        if (level === "info" || level === "success") {
          Logger.info(`系统通知显示成功: `, { title, body });
        } else if (level === "warning") {
          Logger.warn(`系统通知显示成功: `, { title, body });
        } else if (level === "error") {
          Logger.error(`系统通知显示成功: `, { title, body });
        }
      } else {
        Logger.warn("系统不支持通知功能", { level, title, body });
      }
    } catch (error) {
      Logger.error("显示系统通知失败", { error });
    }
  }

  /**
   * 打开文件对话框
   * 异步显示系统文件选择对话框
   * @param options - 对话框配置选项
   * @returns 对话框返回值，包含选中的文件路径和是否取消
   * @throws {Error} 当对话框打开失败时抛出错误
   */
  public async openDialog(
    options: OpenDialogOptions,
  ): Promise<OpenDialogReturnValue> {
    try {
      Logger.debug("打开对话框", { options: JSON.stringify(options) });
      const result = await dialog.showOpenDialog(options);
      Logger.debug("对话框结果", { result: JSON.stringify(result) });
      return result;
    } catch (error) {
      Logger.error("打开对话框失败", { error });
      throw error;
    }
  }
}

export default SystemService;

export const systemService = SystemService.getInstance();
