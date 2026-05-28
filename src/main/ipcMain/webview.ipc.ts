import { ipcMain, BrowserWindow } from 'electron'
import { createWebView, reloadWebView, destroyWebView, resizeWebView, goBack, goForward, getNavigationState, hideWebView } from '@/main/core/apis/webview.api'
import type { ApiResponse, NavigationState, WebContentViewOptions } from '@/shared/types'

// 注册 WebView 相关相关的 IPC 处理函数
export function registerWebViewHandlers(): void {
  ipcMain.handle('webview:create', async (event, url: string, options?: WebContentViewOptions): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await createWebView(url, window, options)
  })

  ipcMain.handle('webview:reload', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await reloadWebView(window)
  })

  ipcMain.handle('webview:destroy', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await destroyWebView(window)
  })

  ipcMain.handle('webview:hide', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await hideWebView(window)
  })

  ipcMain.handle('webview:resize', async (event, options: WebContentViewOptions): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await resizeWebView(window, options)
  })

  ipcMain.handle('webview:goBack', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await goBack(window)
  })

  ipcMain.handle('webview:goForward', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await goForward(window)
  })

  ipcMain.handle('webview:getNavigationState', async (event): Promise<ApiResponse<NavigationState>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await getNavigationState(window)
  })

}
