import { ipcMain } from 'electron'
import { windowService } from '@/main/core/services/window.service'

// 注册窗口控制相关的 IPC 处理函数
export function registerWindowHandlers() {
  ipcMain.handle('window:minimize', () => {
    windowService.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    windowService.maximize()
  })

  ipcMain.handle('window:close', () => {
    windowService.close()
  })

  ipcMain.handle('window:isMaximized', async () => {
    return await windowService.isMaximized()
  })
}