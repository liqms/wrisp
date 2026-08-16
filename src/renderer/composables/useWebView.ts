import { computed } from 'vue'
import { useWebViewStore } from '@/renderer/store/webview.store'
import { logger } from '@/renderer/utils/logger.utils'
import type { ApiResponse, WebContentViewOptions } from '@/shared/types'
import { ErrorCode } from '@/shared/enums'
import { handleApiError, getErrorMessage } from '@/renderer/utils/error.utils'

interface UseWebViewOptions {
  /** 初始 URL */
  initialUrl?: string
  /** WebView 内容视图选项 */
  webContentViewOptions?: WebContentViewOptions | undefined
}

/**
 * WebView 组合函数
 */
export function useWebView(options: UseWebViewOptions = {}) {
  const { initialUrl = '', webContentViewOptions = undefined } = options

  // 依赖注入
  const store = useWebViewStore()

  // 计算属性
  const isElectron = computed(() => {
    return typeof window !== 'undefined' && !!window.electronAPI
  })

  // 方法

  /**
   * 加载 WebView
   */
  const loadWebView = async (url: string, options?: WebContentViewOptions): Promise<void> => {
    // 验证 URL 有效性
    if (!url || !url.trim()) {
      store.setError(ErrorCode.WEBVIEW_URL_EMPTY, getErrorMessage(ErrorCode.WEBVIEW_URL_EMPTY))
      return
    }

    if (!isElectron.value) {
      store.setError(ErrorCode.WEBVIEW_FUNCTION_NOT_AVAILABLE, getErrorMessage(ErrorCode.WEBVIEW_FUNCTION_NOT_AVAILABLE))
      return
    }

    try {
      store.setLoading(true)
      store.clearError()

      const viewOptions = options || webContentViewOptions
      // 创建纯对象副本，避免 IPC 序列化问题
      const viewOptionsCopy = viewOptions ? JSON.parse(JSON.stringify(viewOptions)) : undefined
      logger.info('前端 正在加载 WebView', { url, viewOptions: viewOptionsCopy })

      let response!: ApiResponse<void>

      if (viewOptionsCopy) {
        response = await window.electronAPI.webview.create(url, viewOptionsCopy)
      } else {
        response = await window.electronAPI.webview.create(url)
      }

      if (response.success) {
        store.setCurrentUrl(url)
        store.setLoading(false)
        store.addToHistory(url)

        logger.info('前端 WebView 加载成功', { url })

        // 初始化导航状态
        await updateNavigationState()
      } else {
        store.setError(response.code, handleApiError(response))

      }
    } catch (err) {
      store.setError(ErrorCode.WEBVIEW_LOAD_FAILED, getErrorMessage(ErrorCode.WEBVIEW_LOAD_FAILED))
      logger.error('前端 WebView 加载失败', { url, error: String(err) })
    } finally {
      // 确保 loading 状态被正确重置
      store.setLoading(false)
    }
  }
  /**
   * 重设 WebView 大小
   * @param options 内容视图选项
   */
  const resize = async (options: WebContentViewOptions) => {
    if (!isElectron.value) return

    try {
      const optionsCopy = JSON.parse(JSON.stringify(options))
      const response = await window.electronAPI.webview.resize(optionsCopy)

      if (response.success) {
        logger.info('前端 WebView 重设成功', { optionsCopy })

      } else {
        store.setError(response.code, handleApiError(response))
      }
    } catch (err) {
      store.setError(ErrorCode.WEBVIEW_RESIZE_FAILED, getErrorMessage(ErrorCode.WEBVIEW_RESIZE_FAILED))
      logger.error('前端 WebView 重设失败', { error: String(err) })
    }
  }
  /**
   * 销毁 WebView
   */
  const destroy = async (): Promise<void> => {
    if (!isElectron.value) return

    try {
      const response = await window.electronAPI.webview.destroy()

      if (response.success) {
        logger.info('前端 WebView 销毁成功')

      } else {
        store.setError(response.code, handleApiError(response))
      }
    } catch (err) {
      store.setError(ErrorCode.WEBVIEW_DESTROY_FAILED, getErrorMessage(ErrorCode.WEBVIEW_DESTROY_FAILED))
      logger.error('前端 WebView 销毁失败', { error: String(err) })
    }
  }

  /**
   * 隐藏 WebView
   * @param options 内容视图选项
   */
  const hide = async (): Promise<void> => {
    if (!isElectron.value) return

    try {
      store.setLoading(true)
      const response = await window.electronAPI.webview.hide()

      if (response.success) {
        logger.info('前端 WebView 隐藏成功')

        // 隐藏后更新导航状态
        setTimeout(() => updateNavigationState(), 500)
      } else {
        store.setError(response.code, handleApiError(response))
      }
    } catch (err) {
      store.setError(ErrorCode.WEBVIEW_HIDE_FAILED, getErrorMessage(ErrorCode.WEBVIEW_HIDE_FAILED))
      logger.error('前端 WebView 隐藏失败', { error: String(err) })
    } finally {
      // 确保 loading 状态被正确重置
      store.setLoading(false)
    }
  }

  /**
   * 后退
   */
  const goBack = async (): Promise<void> => {
    if (!isElectron.value || !store.canGoBack) return

    try {
      const response = await window.electronAPI.webview.goBack()

      if (response.success) {
        logger.info('前端 WebView 后退成功')

        // 后退后更新导航状态
        setTimeout(() => updateNavigationState(), 500)
      } else {
        store.setError(response.code, handleApiError(response))
      }
    } catch (err) {
      store.setError(ErrorCode.WEBVIEW_GO_BACK_FAILED, getErrorMessage(ErrorCode.WEBVIEW_GO_BACK_FAILED))
      logger.error('前端 WebView 后退失败', { error: String(err) })
    }
  }

  /**
   * 前进
   */
  const goForward = async (): Promise<void> => {
    if (!isElectron.value || !store.canGoForward) return

    try {
      const response = await window.electronAPI.webview.goForward()

      if (response.success) {
        logger.info('前端 WebView 前进成功')

        // 前进后更新导航状态
        setTimeout(() => updateNavigationState(), 500)
      } else {
        store.setError(response.code, handleApiError(response))
      }
    } catch (err) {
      store.setError(ErrorCode.WEBVIEW_GO_FORWARD_FAILED, getErrorMessage(ErrorCode.WEBVIEW_GO_FORWARD_FAILED))
      logger.error('前端 WebView 前进失败', { error: String(err) })
    }
  }

  /**
   * 更新导航状态
   */
  const updateNavigationState = async (): Promise<void> => {
    if (!isElectron.value) return

    try {
      // 获取导航状态
      const response = await window.electronAPI.webview.getNavigationState()
      if (response.success && response.data) {
        // 确保数据类型正确
        const navigationState = response.data as { canGoBack: boolean; canGoForward: boolean }
        store.setNavigationState(
          navigationState.canGoBack || false,
          navigationState.canGoForward || false
        )

        logger.debug('导航状态更新', {
          canGoBack: store.canGoBack,
          canGoForward: store.canGoForward
        })
      } else {
        store.setError(response.code, getErrorMessage(response.code))
        logger.warn('获取导航状态失败', { error: getErrorMessage(response.code) })
      }
    } catch (error) {
      store.setError(ErrorCode.WEBVIEW_GET_NAVIGATION_STATE_FAILED, getErrorMessage(ErrorCode.WEBVIEW_GET_NAVIGATION_STATE_FAILED))
      logger.warn('获取导航状态失败', { error: String(error) })
    }
  }

  /**
   * URL 变更处理
   */
  const handleUrlChange = (newUrl: string): void => {
    const url = newUrl.trim()
    if (!url) return

    // 添加协议前缀（如果缺失）
    let formattedUrl = url
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl
    }

    loadWebView(formattedUrl)
  }

  /**
   * 重试加载
   */
  const retry = (): void => {
    loadWebView(store.currentUrl)
  }

  /**
   * 在外部浏览器打开
   */
  const openExternal = (): void => {
    if (isElectron.value && window.electronAPI.system) {
      // 使用系统默认浏览器打开
      window.open(store.currentUrl, '_blank')
    } else {
      // 非 Electron 环境直接打开
      window.open(store.currentUrl, '_blank')
    }
  }

  /**
   * 初始化
   */
  const init = (): void => {
    if (initialUrl) {
      // 创建纯对象副本，避免 IPC 序列化问题
      const optionsCopy = webContentViewOptions ? { ...webContentViewOptions } : undefined
      logger.info('WebView 初始化', { url: initialUrl, viewOptions: optionsCopy })
      loadWebView(initialUrl, webContentViewOptions)
    }
  }

  return {
    // 状态（从 store 获取）
    loading: store.loading,
    errorCode: store.errorCode,
    errorMessage: store.errorMessage,
    currentUrl: store.currentUrl,
    canGoBack: store.canGoBack,
    canGoForward: store.canGoForward,

    // 计算属性
    isElectron,
    hasError: store.hasError,
    isReady: store.isReady,

    // 方法
    loadWebView,
    resize,
    destroy,
    hide,
    goBack,
    goForward,
    handleUrlChange,
    retry,
    openExternal,
    updateNavigationState,
    init
  }
}