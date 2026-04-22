import { BrowserWindow } from 'electron'

/**
 * 窗口服务
 * 提供窗口控制功能，包括最小化、最大化、关闭等操作
 */
export class WindowService {
  private static instance: WindowService

  /**
   * 私有构造函数
   * 防止外部实例化
   */
  private constructor() {}

  /**
   * 获取 WindowService 的单例实例
   * @returns WindowService 单例实例
   */
  static getInstance(): WindowService {
    if (!WindowService.instance) {
      WindowService.instance = new WindowService()
    }
    return WindowService.instance
  }

  /**
   * 获取当前聚焦的窗口
   * @returns 当前聚焦的窗口实例，没有聚焦窗口时返回 null
   */
  getFocusedWindow(): BrowserWindow | null {
    return BrowserWindow.getFocusedWindow()
  }

  /**
   * 检查当前窗口是否已最大化
   * @returns 已最大化返回 true，否则返回 false
   */
  isMaximized(): boolean {
    const focusedWindow = this.getFocusedWindow()
    return focusedWindow ? focusedWindow.isMaximized() : false
  }

  /**
   * 最小化当前窗口
   * 将当前聚焦的窗口最小化到任务栏
   */
  minimize(): void {
    const focusedWindow = this.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.minimize()
    }
  }

  /**
   * 最大化或还原当前窗口
   * 如果窗口已最大化则还原，否则最大化窗口
   */
  maximize(): void {
    const focusedWindow = this.getFocusedWindow()
    if (focusedWindow) {
      if (focusedWindow.isMaximized()) {
        focusedWindow.unmaximize()
      } else {
        focusedWindow.maximize()
      }
    }
  }

  /**
   * 关闭当前窗口
   * 关闭当前聚焦的窗口
   */
  close(): void {
    const focusedWindow = this.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.close()
    }
  }
}

export const windowService = WindowService.getInstance()
