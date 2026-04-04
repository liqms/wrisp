import { ipcMain, BrowserWindow } from 'electron'
import { createWebView, reloadWebView, destroyWebView, goBack, goForward } from '@/main/core/apis/webview.api'
import type { ApiResponse } from '@/shared/types'

// 注册 WebView 相关相关的 IPC 处理函数
export function registerWebViewHandlers(): void {
  ipcMain.handle('webview:create', async (event, url: string): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await createWebView(url, window)
  })

  ipcMain.handle('webview:reload', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await reloadWebView(window)
  })

  ipcMain.handle('webview:destroy', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await destroyWebView(window)
  })

  ipcMain.handle('webview:goBack', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await goBack(window)
  })

  ipcMain.handle('webview:goForward', async (event): Promise<ApiResponse<void>> => {
    const window = BrowserWindow.fromWebContents(event.sender)!
    return await goForward(window)
  })
}
