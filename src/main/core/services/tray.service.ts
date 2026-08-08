import { app, Tray, Menu, BrowserWindow, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { Logger } from '@/main/utils/logger'

/**
 * 系统托盘服务
 * 提供系统托盘功能，包括托盘图标、上下文菜单等
 */
export class TrayService {
  private static instance: TrayService | null = null
  private tray: Tray | null = null

  private constructor() { }

  static getInstance(): TrayService {
    if (!TrayService.instance) {
      TrayService.instance = new TrayService()
    }
    return TrayService.instance
  }

  /**
   * 检查托盘是否已初始化
   */
  isInitialized(): boolean {
    return this.tray !== null
  }

  /**
   * 初始化系统托盘
   */
  initialize(): void {
    if (this.tray) return

    const iconPath = this.resolveIconPath()
    if (!iconPath) {
      Logger.warn('[Tray] 未找到托盘图标文件，跳过托盘初始化')
      return
    }

    try {
      const icon = nativeImage.createFromPath(iconPath)
      // 调整图标大小为 16x16（Windows 托盘标准尺寸）
      const resizedIcon = icon.resize({ width: 16, height: 16 })
      this.tray = new Tray(resizedIcon)
      this.tray.setToolTip('PenTip')
      this.tray.setContextMenu(this.createContextMenu())

      // 点击托盘图标显示主窗口
      this.tray.on('click', () => {
        this.showMainWindow()
      })

      Logger.info('[Tray] 系统托盘初始化成功')
    } catch (error) {
      Logger.error('[Tray] 系统托盘初始化失败', { error: String(error) })
    }
  }

  /**
   * 销毁系统托盘
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
      Logger.info('[Tray] 系统托盘已销毁')
    }
  }

  /**
   * 创建托盘上下文菜单
   */
  private createContextMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: '打开主界面',
        click: () => this.showMainWindow(),
      },
      {
        label: '打开官方网站',
        click: () => {
          shell.openExternal('https://pentip.app')
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.destroy()
          app.quit()
        },
      },
    ])
  }

  /**
   * 显示主窗口
   */
  private showMainWindow(): void {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const mainWindow = windows[0]
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  }

  /**
   * 解析托盘图标路径
   * 优先使用当前运行目录下的图标，兼容开发和生产环境
   */
  private resolveIconPath(): string | null {
    const possiblePaths = [
      // 开发环境：__dirname = dist-electron/
      path.join(__dirname, '..', 'static', 'pentip.png'),
      // 生产环境（asar 打包）
      path.join(process.resourcesPath || '', 'static', 'pentip.png'),
      // 应用根目录
      path.join(app.getAppPath(), 'static', 'pentip.png'),
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    return null
  }
}

export const trayService = TrayService.getInstance()