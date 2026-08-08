import { app, BrowserWindow, screen } from 'electron'
import Store from 'electron-store'
import path from 'path'
import { CONFIG_DIR } from '@/main/constants'

interface WindowSize {
  width: number
  height: number
}

/**
 * 窗口服务
 * 提供窗口控制功能，包括最小化、最大化、关闭等操作
 */
export class WindowService {
  private static instance: WindowService
  private store: Store<WindowSize>

  /**
   * 私有构造函数
   * 防止外部实例化
   */
  private constructor() {
    const configDir = path.join(app.getPath('userData'), CONFIG_DIR)
    this.store = new Store<WindowSize>({
      name: 'window',
      cwd: configDir,
      fileExtension: 'json',
      clearInvalidConfig: true,
    })
  }

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

  /**
   * 获取初始窗口大小
   * 优先从保存的配置中读取已保存的窗口大小，
   * 否则使用当前桌面工作区域大小的 80%
   * @returns 窗口宽高
   */
  getInitialSize(): WindowSize {
    const width = this.store.get('width')
    const height = this.store.get('height')
    if (width && height) {
      return { width, height }
    }
    const { width: desktopWidth, height: desktopHeight } = screen.getPrimaryDisplay().workAreaSize
    return {
      width: Math.round(desktopWidth * 0.8),
      height: Math.round(desktopHeight * 0.8),
    }
  }

  /**
   * 保存窗口大小到配置文件
   * @param size 窗口宽高
   */
  saveWindowSize(size: WindowSize): void {
    this.store.set('width', size.width)
    this.store.set('height', size.height)
  }
}

export const windowService = WindowService.getInstance()