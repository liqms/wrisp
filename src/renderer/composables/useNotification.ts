import { computed } from 'vue'
import { useNotificationStore } from '@/renderer/store/notification.store'
import { TimeUtil } from '@/shared/utils'
import { BrowserCryptoUtil as CryptoUtil } from '@/renderer/utils/crypto.utils'

export interface NotificationOptions {
    title: string
    content: string
}

/**
 * 前端通知相关的组合函数
 */
export function useFrontendNotification(options: NotificationOptions) {
    const notificationStore = useNotificationStore()
    const id = computed(() => CryptoUtil.generateUUID())
    const now = Date.now()
    const meta = TimeUtil.format(now, 'yyyy-MM-dd HH:mm')
    const message = computed(() => ({
        id: id.value,
        content: options.content,
        timestamp: now,
        title: options.title,
        meta: meta,
        timeout: 2500,
    }))

    return {
        info: (title: string, content: string) => notificationStore.addNotification({
            ...message.value,
            level: 'info',
            title: title,
            content: content,
        }),
        success: (title: string, content: string) => notificationStore.addNotification({
            ...message.value,
            level: 'success',
            title: title,
            content: content,
        }),
        error: (title: string, content: string) => notificationStore.addNotification({
            ...message.value,
            level: 'error',
            title: title,
            content: content,
        }),
        warn: (title: string, content: string) => notificationStore.addNotification({
            ...message.value,
            level: 'warning',
            title: title,
            content: content,
        }),
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

