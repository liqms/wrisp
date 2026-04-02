import { ipcMain } from 'electron'
import { createWebView, reloadWebView, destroyWebView, goBack, goForward } from '@/main/core/apis/webview.api'
import type { ApiResponse } from '@/shared/types'

// 注册 WebView 相关相关的 IPC 处理函数
export function registerWebViewHandlers(): void {
  ipcMain.handle('webview:create', async (_, url: string): Promise<ApiResponse<void>> => {
    return await createWebView(url)
  })

  ipcMain.handle('webview:reload', async (): Promise<ApiResponse<void>> => {
    return await reloadWebView()
  })

  ipcMain.handle('webview:destroy', async (): Promise<ApiResponse<void>> => {
    return await destroyWebView()
  })

  ipcMain.handle('webview:goBack', async (): Promise<ApiResponse<void>> => {
    return await goBack()
  })

  ipcMain.handle('webview:goForward', async (): Promise<ApiResponse<void>> => {
    return await goForward()
  })
}
