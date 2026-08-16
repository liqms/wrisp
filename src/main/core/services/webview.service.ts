import { BrowserWindow, WebContentsView, WebContents } from 'electron';
import { Logger } from '@/main/utils/logger';
import { WebContentViewOptions } from '@/shared/types';

/**
 * WebView 服务
 * 提供内嵌 WebView 的管理功能，包括创建、显示、隐藏、销毁和导航控制
 * 支持加载外部 URL、导航历史管理和窗口大小自适应
 */
class WebViewService {
  private static instance: WebViewService | null = null
  private mainWindow: BrowserWindow
  private webView: WebContentsView | null = null
  private webContentViewOptions: WebContentViewOptions = {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  }
  private isVisible: boolean = false
  private resizeHandler: ((event: Electron.Event) => void) | null = null
  private navigationHistory: string[] = []
  private currentHistoryIndex: number = -1

  /**
   * 私有构造函数
   * 初始化 WebView 服务实例
   * @param window - 主窗口实例
   */
  private constructor(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * 获取 WebViewService 的单例实例
   * @param window - 主窗口实例，首次调用时必须提供
   * @returns WebViewService 单例实例
   * @throws {Error} 当未初始化时抛出错误
   */
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
   * 异步创建 WebContentsView 实例并加载指定 URL
   * @param url - 要加载的 URL
   * @param options - 配置选项，可选
   * @returns Promise<void>
   * @throws {Error} 当 WebView 创建失败时抛出错误
   */
  async create(url: string, options?: WebContentViewOptions): Promise<void> {
    try {
      // 销毁已存在的 WebView
      if (this.webView) {
        await this.destroy()
      }

      Logger.debug('后端 WebView 创建', { url, options })

      // 创建 WebContentsView 实例
      this.webView = new WebContentsView({
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          // 支持扫码登录和页面跳转的关键配置
          webSecurity: true,
          allowRunningInsecureContent: false,
          images: true,
          javascript: true,
          webgl: true,
          plugins: true,
          // 支持现代 Web 功能
          enableWebSQL: false,
          enableBlinkFeatures: '',
          // Cookie 和存储支持
          partition: 'persist:webview',
          // 开发者工具支持（便于调试）
          devTools: true,
          // 开启 Webview 标签，支持嵌套 WebView
          webviewTag: true
        } 
      })

      // 设置内容视图的初始位置和大小
      this.calculateInitialBounds(options)
      
      this.webView.setBounds(this.webContentViewOptions)

      Logger.debug('后端 WebView 设置初始位置和大小', { webContentViewOptions: this.webContentViewOptions })

      // 将视图添加到主窗口的内容视图中
      this.mainWindow.contentView.addChildView(this.webView)
      this.isVisible = true

      // 监听窗口大小变化
      this.resizeHandler = () => this.handleResize()
      this.mainWindow.on('will-resize', this.resizeHandler)

      // 加载外部 URL
      await this.webView.webContents.loadURL(url)
      Logger.info('后端 WebView 创建成功', { url })

      // 监听导航事件
      this.setupNavigationControl()

    } catch (error) {
      Logger.error('后端 WebView 创建失败', { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * 计算内容视图的初始位置和大小
   * 根据配置选项和主窗口大小计算 WebView 的边界
   * @param options - 配置选项，可选
   */
  private calculateInitialBounds(options?: WebContentViewOptions): void {
    const contentViewBounds = this.mainWindow.getContentSize()
    this.webContentViewOptions = {
      x: options?.x || 0,
      y: options?.y || 0,
      width: options?.width || contentViewBounds[0],
      height: options?.height || contentViewBounds[1]
    }
  }

  /**
   * 处理窗口大小变化
   * 当主窗口大小改变时，自动调整 WebView 的大小
   */
  private handleResize(): void {
    if (this.webView && this.isVisible) {
      const contentViewBounds = this.mainWindow.getContentSize()
      this.webView.setBounds({
        x: this.webContentViewOptions.x,
        y: this.webContentViewOptions.y,
        width: contentViewBounds[0],
        height: contentViewBounds[1] - this.webContentViewOptions.y
      })
    }
  }

  /**
   * 设置导航控制
   * 监听 WebView 的导航事件，记录导航历史并处理新窗口打开请求
   */
  private setupNavigationControl(): void {
    if (!this.webView) return

    this.webView.webContents.on('will-navigate', (_event, navigationUrl) => {
      Logger.debug('后端WebView尝试导航到', { url: navigationUrl })
      // 记录用户导航历史
      this.recordNavigation(navigationUrl)
      // 允许导航继续（不要调用 event.preventDefault()）
      // 这样可以支持扫码登录后的页面跳转
    })
    // 监听页面加载完成
    this.webView.webContents.on('did-finish-load', () => {
      const canGoBack = this.webView?.webContents.navigationHistory.canGoBack() || false
      const canGoForward = this.webView?.webContents.navigationHistory.canGoForward() || false
      
      Logger.debug('后端WebView页面加载完成', {
        url: this.webView?.webContents.getURL(),
        canGoBack,
        canGoForward
      })
      
      // 更新导航状态
      this.updateNavigationState(canGoBack, canGoForward)
    })

    // 监听新窗口打开请求（支持扫码登录等场景）
    this.webView.webContents.setWindowOpenHandler(({ url }) => {
      Logger.debug('新窗口打开请求', { url })
      // 在当前 WebView 中加载新 URL，而不是打开新窗口
      if (url) {
        this.webView?.webContents.loadURL(url)
      }
      return { action: 'deny' } // 阻止默认的新窗口行为
    })
  }
  /**
   * 更新导航状态
   * 将导航状态（是否可后退、前进）传递给渲染进程
   * @param canGoBack - 是否可以后退
   * @param canGoForward - 是否可以前进
   */
  private updateNavigationState(canGoBack: boolean, canGoForward: boolean): void {
    // 这里可以添加 IPC 通信，将导航状态传递给渲染进程
    Logger.debug('更新导航状态', { canGoBack, canGoForward })
    // 在实际实现中，这里应该通过 IPC 将状态发送给前端
  }

  /**
   * 记录导航历史
   * 将新 URL 添加到导航历史记录中
   * @param url - 导航到的 URL
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
   * 返回导航历史记录的副本
   * @returns 导航历史 URL 数组
   */
  public getNavigationHistory(): string[] {
    return [...this.navigationHistory]
  }
  /**
   * 隐藏视图
   * 从主窗口中移除 WebView，但不销毁实例
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
   * 将 WebView 添加到主窗口中，并调整大小
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
   * 销毁视图
   * 异步销毁 WebView 实例，释放所有资源
   * @returns Promise<void>
   * @throws {Error} 当销毁失败时抛出错误
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

        // 正确销毁 WebView 实例
        // 只需要设置 webView 为 null，垃圾回收器会自动处理
        this.webView = null
        this.isVisible = false
        Logger.info('后端 WebView 销毁成功')
      } catch (error) {
        Logger.error('后端 WebView 销毁失败', { error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    }
  }

  /**
   * 重设视图大小和位置
   * 手动设置 WebView 的位置和尺寸
   * @param options - 配置选项，包含 x, y, width, height
   */
  resize(options: WebContentViewOptions): void {
    if (this.webView) {
      try {
        // 更新内部配置
        this.webContentViewOptions = {
          x: options.x ?? this.webContentViewOptions.x,
          y: options.y ?? this.webContentViewOptions.y,
          width: options.width ?? this.webContentViewOptions.width,
          height: options.height ?? this.webContentViewOptions.height
        }

        // 设置新的边界
        this.webView.setBounds(this.webContentViewOptions)
        Logger.debug('WebView 尺寸和位置已更新', { webContentViewOptions: this.webContentViewOptions })
      } catch (error) {
        Logger.error('WebView 重设大小失败', { error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    }
  }

  /**
   * 刷新视图
   * 异步重新加载当前页面
   * @returns Promise<void>
   * @throws {Error} 当重新加载失败时抛出错误
   */
  async reload(): Promise<void> {
    if (this.webView) {
      try {
        await this.webView.webContents.reload()
        Logger.debug('后端 WebView 重新加载成功')
      } catch (error) {
        Logger.error('后端 WebView 重新加载失败', { error: error instanceof Error ? error.message : String(error) })
        throw error
      }
    }
  }

  /**
   * 获取 WebContents 实例
   * @returns WebContents 实例，WebView 未创建时返回 null
   */
  getWebContents(): WebContents | null {
    return this.webView?.webContents || null
  }

  /**
   * 检查 WebView 是否已创建
   * @returns 已创建返回 true，否则返回 false
   */
  isCreated(): boolean {
    return this.webView !== null
  }

  /**
   * 检查 WebView 是否可见
   * @returns 可见返回 true，否则返回 false
   */
  getVisibility(): boolean {
    return this.isVisible
  }

  /**
   * 返回上一页
   * 如果可以后退，则导航到上一页
   */
  goBack(): void {
    if (this.webView?.webContents.navigationHistory.canGoBack()) {
      this.webView.webContents.navigationHistory.goBack()
    }
  }

  /**
   * 前进下一页
   * 如果可以前进，则导航到下一页
   */
  goForward(): void {
    if (this.webView?.webContents.navigationHistory.canGoForward()) {
      this.webView.webContents.navigationHistory.goForward()
    }
  }

  /**
   * 获取导航状态
   * 返回当前是否可以后退和前进的状态
   * @returns 包含 canGoBack 和 canGoForward 的状态对象
   */
  getNavigationState(): { canGoBack: boolean; canGoForward: boolean } {
    const canGoBack = this.webView?.webContents.navigationHistory.canGoBack() || false
    const canGoForward = this.webView?.webContents.navigationHistory.canGoForward() || false
    
    return { canGoBack, canGoForward }
  }
}

export default WebViewService