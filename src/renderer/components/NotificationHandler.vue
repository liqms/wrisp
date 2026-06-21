<template>
  <!-- 这个组件不渲染任何内容，只负责处理通知逻辑 -->
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useNotification, useDialog } from 'naive-ui'
import { useNotificationStore } from '@/renderer/store/notification.store'
import type { NotificationMessage } from '@/shared/types'
import { TimeUtil } from '@/shared/utils'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const notification = useNotification()
const dialog = useDialog()
const notificationStore = useNotificationStore()

let notificationListener: ((notification: NotificationMessage) => void) | null = null
const displayedIds = new Set<string>()

/** 监听 store 中新增的通知并用 Naive UI 展示 */
watch(() => notificationStore.notifications.length, () => {
  const notifications = notificationStore.notifications
  for (const msg of notifications) {
    if (displayedIds.has(msg.id)) continue
    displayedIds.add(msg.id)

    const levelToType: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
      'info': 'info',
      'success': 'success',
      'warning': 'warning',
      'error': 'error',
    }

    notification[levelToType[msg.level]]({
      content: msg.content,
      title: msg.title || '',
      description: msg.description || '',
      meta: msg.timestamp ? TimeUtil.format(msg.timestamp, 'YYYY-MM-DD HH:mm') : '',
      duration: msg.timeout || 2000,
    })
  }
})

/** 监听未完成任务续传确认 */
function setupPendingTaskListener(): void {
  window.electronAPI.on('task:pending', (summary: { count: number; types: string[]; groups: string[] }) => {
    const typeLabels = summary.types.join(', ')
    dialog.warning({
      title: t('NOTIFICATION.DOWNLOAD.TITLE'),
      content: t('NOTIFICATION.DOWNLOAD.CONTENT', {
        count: summary.count,
        types: typeLabels,
      }),
      positiveText: t('ACTION.COMMON.CONFIRM'),
      negativeText: t('ACTION.COMMON.CANCEL'),
      onPositiveClick: () => {
        window.electronAPI.send('task:confirmResume', null)
      },
      onNegativeClick: () => {
        window.electronAPI.send('task:cancelResume', null)
      },
      onClose: () => {
        window.electronAPI.send('task:cancelResume', null)
      },
      maskClosable: false,
      closable: false,
    })
  })
}

onMounted(() => {
  notificationListener = (notificationMsg: NotificationMessage) => {
    notificationStore.addNotification(notificationMsg)
  }

  window.electronAPI.onNotification(notificationListener)
  setupPendingTaskListener()
})

onUnmounted(() => {
  if (notificationListener) {
    window.electronAPI.removeNotificationListener?.()
  }
  window.electronAPI.off('task:pending')
})
</script>