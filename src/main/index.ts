import { app, BrowserWindow, screen } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import { dirname } from 'path'
import { Logger } from './utils/logger'
import dotenv from 'dotenv'

// 加载环境变量，指定 UTF-8 编码，禁用提示
dotenv.config({ encoding: 'utf8', override: true })

import { registerWindowHandlers, registerConfigHandlers, registerSystemHandlers, registerNotificationHandlers, registerLoggerHandlers } from './ipcMain'


const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 初始化 Logger
Logger.initialize()
// 清理过期日志文件
Logger.cleanupOldLogsAsync()

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const mainWindow = new BrowserWindow({
    width: width * 0.8,
    height: height * 0.8,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
