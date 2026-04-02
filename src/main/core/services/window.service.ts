import { BrowserWindow } from 'electron'

export class WindowService {
  private static instance: WindowService

  private constructor() {}

  static getInstance(): WindowService {
    if (!WindowService.instance) {
      WindowService.instance = new WindowService()
    }
    return WindowService.instance
  }

  getFocusedWindow(): BrowserWindow | null {
    return BrowserWindow.getFocusedWindow()
  }

  isMaximized(): boolean {
    const focusedWindow = this.getFocusedWindow()
    return focusedWindow ? focusedWindow.isMaximized() : false
  }

  minimize(): void {
    const focusedWindow = this.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.minimize()
    }
  }

  maximize(): void {
    const focusedWindow = this.getFocusedWindow()
    if (focusedWindow) {
      if (focusedWindow.isMaximized()) {
        focusedWindow.unmaximize()
      } else {
        focusedWindow.maximize()
      }
    }
  }

  close(): void {
    const focusedWindow = this.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.close()
    }
  }
}

export const windowService = WindowService.getInstance()
