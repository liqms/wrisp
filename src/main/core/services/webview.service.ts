import { BrowserWindow, WebContentsView, WebContents } from 'electron';
import { Logger } from '@/main/utils/logger';

interface WebViewConfig {
  webPreferences?: Electron.WebPreferences;
  bounds?: Electron.Rectangle;
}

class WebViewService {
  private static instance: WebViewService | null = null
  private mainWindow: BrowserWindow
  private webView: WebContentsView | null = null
  private isVisible: boolean = false
  private resizeHandler: ((event: Electron.Event) => void) | null = null
  private navigationHistory: string[] = []
  private currentHistoryIndex: number = -1

  private constructor(window: BrowserWindow) {
    this.mainWindow = window
  }

  public static getInstance(window?: BrowserWindow): WebViewService {
    if (!WebViewService.instance && window) {
      WebViewService.instance = new WebViewService(window)
    }
    if (!WebViewService.instance) {
      throw new Error('WebViewService not initialized')
    }
    return WebViewService.instance
  }

  /**
   * 创建 WebView
   * @param url 要加载的 URL
   * @param config 配置选项
   * @returns Promise<void>
   */
  async create(url: string, config: WebViewConfig = {}): Promise<void> {
    try {
      // 销毁已存在的 WebView
      if (this.webView) {
        await this.destroy()
      }

      // 创建 WebContentsView 实例
      this.webView = new WebContentsView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          ...config.webPreferences
        }
      })

      // 设置视图的初始位置和大小
      const bounds = config.bounds || this.mainWindow.getBounds()
      this.webView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height
      })

      // 将视图添加到主窗口的内容视图中
      this.mainWindow.contentView.addChildView(this.webView)
      this.isVisible = true

      // 监听窗口大小变化
      this.resizeHandler = () => this.handleResize()
      this.mainWindow.on('will-resize', this.resizeHandler)

      // 加载外部 URL
      await this.webView.webContents.loadURL(url)
      Logger.info('WebView 创建成功', { url })

      // 监听导航事件
      this.setupNavigationControl()

    } catch (error) {
      Logger.error('WebView 创建失败', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize(): void {
    if (this.webView && this.isVisible) {
      const bounds = this.mainWindow.getBounds()
      this.webView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: bounds.height
      })
    }
  }

  /**
   * 设置导航控制
   */
  private setupNavigationControl(): void {
    if (!this.webView) return

    this.webView.webContents.on('will-navigate', (event, navigationUrl) => {
      Logger.debug('尝试导航到', { url: navigationUrl })
      // 可以在这里添加导航策略，例如：
      // - 限制只能访问特定域名
      // - 阻止恶意 URL
      // - 记录用户浏览历史
      this.recordNavigation(navigationUrl)
      // 继续导航
      event.preventDefault()
    })
    // 监听页面加载完成
    this.webView.webContents.on('did-finish-load', () => {
      Logger.debug('页面加载完成', {
        url: this.webView?.webContents.getURL(),
        canGoBack: this.webView?.webContents.navigationHistory.canGoBack(),
        canGoForward: this.webView?.webContents.navigationHistory.canGoForward()
      })
    })
  }
  /**
   * 记录导航历史
   */
  private recordNavigation(url: string): void {
    // 如果当前不是历史记录中的最新页面，清除后面的历史
    if (this.currentHistoryIndex < this.navigationHistory.length - 1) {
      this.navigationHistory = this.navigationHistory.slice(0, this.currentHistoryIndex + 1)
    }

    this.navigationHistory.push(url)
    this.currentHistoryIndex = this.navigationHistory.length - 1
  }

  /**
   * 获取导航历史
   */
  public getNavigationHistory(): string[] {
    return [...this.navigationHistory]
  }
  /**
   * 隐藏视图
   */
  hide(): void {
    if (this.webView && this.isVisible) {
      try {
        this.mainWindow.contentView.removeChildView(this.webView)
        this.isVisible = false
        Logger.debug('WebView 隐藏成功')
      } catch (error) {
        Logger.error('WebView 隐藏失败', { error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  /**
   * 显示视图
   */
  show(): void {
    if (this.webView && !this.isVisible) {
      try {
        this.mainWindow.contentView.addChildView(this.webView)
        this.isVisible = true
        // 确保尺寸正确
        this.handleResize()
        Logger.debug('WebView 显示成功')
      } catch (error) {
        Logger.error('WebView 显示失败', { error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  /**
   * 销毁视图，释放资源
   */
  async destroy(): Promise<void> {
    if (this.webView) {
      try {
        // 移除事件监听器
        if (this.resizeHandler) {
          this.mainWindow.off('will-resize', this.resizeHandler)
          this.resizeHandler = null
        }

        // 移除并销毁 WebView
        if (this.isVisible) {
          this.mainWindow.contentView.removeChildView(this.webView)
        }

        // 销毁 WebContents
        if (this.webView.webContents) {
          this.webView.webContents.close()
        }

        // 销毁 WebView 实例
        // @ts-ignore - 类型定义可能没有 destroy 方法，但实际存在
        this.webView.destroy();

        this.webView = null
        this.isVisible = false
        Logger.info('WebView 销毁成功')
      } catch (error) {
        Logger.error('WebView 销毁失败', { error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    }
  }

  /**
   * 刷新视图
   */
  async reload(): Promise<void> {
    if (this.webView) {
      try {
        await this.webView.webContents.reload()
        Logger.debug('WebView 重新加载成功')
      } catch (error) {
        Logger.error('WebView 重新加载失败', { error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    }
  }

  /**
   * 获取 WebContents 实例
   * @returns WebContents 实例或 null
   */
  getWebContents(): WebContents | null {
    return this.webView?.webContents || null
  }

  /**
   * 检查 WebView 是否已创建
   * @returns 是否已创建
   */
  isCreated(): boolean {
    return this.webView !== null
  }

  /**
   * 检查 WebView 是否可见
   * @returns 是否可见
   */
  getVisibility(): boolean {
    return this.isVisible
  }

  /**
 * 返回上一页
 */
  goBack(): void {
    if (this.webView?.webContents.navigationHistory.canGoBack()) {
      this.webView.webContents.navigationHistory.goBack()
    }
  }

  /**
 * 前进下一页
 */
  goForward(): void {
    if (this.webView?.webContents.navigationHistory.canGoForward()) {
      this.webView.webContents.navigationHistory.goForward()
    }
  }
}

export default WebViewService