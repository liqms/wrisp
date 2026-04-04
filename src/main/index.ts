import { app, BrowserWindow, screen } from 'electron'
import path from 'path'
import { Logger } from './utils/logger'
import dotenv from 'dotenv'

// 设置控制台编码为 UTF-8（Windows 系统）
if (process.platform === 'win32') {
  process.env.CHCP = '65001'
}

// 加载环境变量，指定 UTF-8 编码，禁用提示
dotenv.config({ encoding: 'utf8', override: true })

import { registerWindowHandlers, registerConfigHandlers, registerSystemHandlers, registerNotificationHandlers, registerLoggerHandlers, registerWebViewHandlers } from './ipcMain'

// 使用传统的 Node.js 路径处理方式
const __dirname = path.dirname(__filename || process.argv[1] || '.')

// 初始化 Logger
Logger.initialize()
// 清理过期日志文件
Logger.cleanupOldLogsAsync()

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  // 在开发模式下使用源文件路径，生产模式下使用编译后路径
  const preloadPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '..', 'main', 'preload.ts')
    : path.join(__dirname, 'preload.js')

  const mainWindow = new BrowserWindow({
    width: width * 0.8,
    height: height * 0.8,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    const devViteUrl = `http://${process.env.DEV_VITE_HOST}:${process.env.DEV_VITE_PORT}`
    Logger.info(`开发环境 VITE_URL: ${devViteUrl}`)
    mainWindow.loadURL(devViteUrl)
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, '..', 'dist-renderer', 'index.html')
    mainWindow.loadFile(indexPath)
  }
}

app.whenReady().then(() => {
  createWindow()
  registerWindowHandlers()
  registerConfigHandlers()
  registerSystemHandlers()
  registerNotificationHandlers()
  registerLoggerHandlers()
  registerWebViewHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
