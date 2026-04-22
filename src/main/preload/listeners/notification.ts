import { ipcRenderer } from 'electron'

type NotificationCallback = (notification: any) => void

class NotificationListenerManager {
  private listeners = new Map<string, NotificationCallback>()

  constructor() {
    this.setupNotificationListener()
  }

  private setupNotificationListener(): void {
    ipcRenderer.on('notification:show', (_, notification) => {
      this.listeners.forEach(callback => {
        try {
          callback(notification)
        } catch (error) {
          // 在预加载脚本中不能使用 Logger，使用 console.error 代替
          console.error('通知监听器执行错误:', error)
        }
      })
    })
  }

  addListener(callback: NotificationCallback): () => void {
    const listenerId = Math.random().toString(36).substring(2)
    this.listeners.set(listenerId, callback)

    return () => {
      this.listeners.delete(listenerId)
    }
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }

  getListenerCount(): number {
    return this.listeners.size
  }
}

export const notificationManager = new NotificationListenerManager()