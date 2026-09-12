import { useNotificationStore } from '@/renderer/store/notification.store'
import type { NotificationMessage } from '@/shared/types'
import { TimeUtil } from '@/shared/utils'
import { BrowserCryptoUtil as CryptoUtil } from '@/renderer/utils/crypto.utils'

export interface NotificationOptions {
    title: string
    content: string
}

/**
 * 前端通知相关的组合函数
 */
export function useFrontendNotification(_options: NotificationOptions) {
    const notificationStore = useNotificationStore()

    function add(level: NotificationMessage['level'], title: string, content: string) {
        notificationStore.addNotification({
            id: CryptoUtil.generateUUID(),
            content,
            timestamp: Date.now(),
            title,
            meta: TimeUtil.format(Date.now(), 'YYYY-MM-DD HH:mm'),
            timeout: 2000,
            level,
        })
    }

    return {
        info: (title: string, content: string) => add('info', title, content),
        success: (title: string, content: string) => add('success', title, content),
        error: (title: string, content: string) => add('error', title, content),
        warn: (title: string, content: string) => add('warning', title, content),
    }
}

/**
 * 系统通知相关的组合函数
 */
export function useSystemNotification() {
    return {
        info: (title: string, content: string) =>
            window.electronAPI.system.showSystemNotification('info', title, content),
        success: (title: string, content: string) =>
            window.electronAPI.system.showSystemNotification('success', title, content),
        error: (title: string, content: string) =>
            window.electronAPI.system.showSystemNotification('error', title, content),
        warn: (title: string, content: string) =>
            window.electronAPI.system.showSystemNotification('warning', title, content),
    }
}