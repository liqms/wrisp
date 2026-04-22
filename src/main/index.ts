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

import { registerWindowHandlers, registerConfigHandlers, registerSystemHandlers, registerLoggerHandlers, registerWebViewHandlers, registerFolderHandlers, registerFileHandlers, registerNovelHandlers } from './ipcMain'
import { databaseMigration } from './core/migration'

// 使用传统的 Node.js 路径处理方式
const __dirname = path.dirname(__filename || process.argv[1] || '.')

// 初始化 Logger
Logger.initialize()
// 清理过期日志文件
Logger.cleanupOldLogsAsync()
// 初始化数据库和数据库迁移
async function initializeDatabase(): Promise<void> {
  try {
    Logger.info('开始初始化数据库')
    
    const isInitialized = databaseMigration.isDatabaseInitialized()
    
    if (!isInitialized) {
      Logger.info('数据库未初始化，执行初始化')
      await databaseMigration.executeDatabaseMigration()
    } else {
      Logger.info('数据库已初始化，检查版本迁移')
      await databaseMigration.executeDatabaseMigration('1.0.0')
    }
    
    Logger.info('数据库初始化完成')
  } catch (error) {
    Logger.error('数据库初始化失败:', { error: String(error) })
    throw error
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  // 在开发模式下使用编译后的文件路径，生产模式下使用编译后路径
  const preloadPath = path.join(__dirname, 'preload.js')

  const mainWindow = new BrowserWindow({
    width: width * 0.8,
    height: height * 0.8,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
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

app.whenReady().then(async () => {
  await initializeDatabase()
  createWindow()
  registerWindowHandlers()
  registerConfigHandlers()
  registerSystemHandlers()
  registerLoggerHandlers()
  registerWebViewHandlers()
  registerFolderHandlers()
  registerFileHandlers()
  registerNovelHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
