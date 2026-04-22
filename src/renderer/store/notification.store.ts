import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { NotificationMessage } from '@/shared/types'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<NotificationMessage[]>([])

  function addNotification(notification: NotificationMessage) {
    notifications.value.push(notification)

    if (notification.timeout && notification.timeout > 0) {
      setTimeout(() => {
        removeNotification(notification.id)
      }, notification.timeout)
    }
  }

  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  function clearAll() {
    notifications.value = []
  }

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll
  }
})
