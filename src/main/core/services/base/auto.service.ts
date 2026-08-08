import { app } from "electron";

/**
 * 自动启动服务
 * 提供应用自动启动管理系统自动化任务
 */
class AutoService {
  private static instance: AutoService;

  private constructor() {}

  public static getInstance(): AutoService {
    if (!AutoService.instance) {
      AutoService.instance = new AutoService();
    }
    return AutoService.instance;
  }

  /**
   * 检查自动启动是否开启
   */
  public isEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin;
  }

  /**
   * 启用自动启动
   */
  public enable(): void {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  /**
   * 禁用自动启动
   */
  public disable(): void {
    app.setLoginItemSettings({ openAtLogin: false });
  }

  /**
   * 暂停指定秒数
   */
  public pause(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

export default AutoService;

export const autoService = AutoService.getInstance();