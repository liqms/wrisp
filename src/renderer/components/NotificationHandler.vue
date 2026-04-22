<template>
  <!-- 这个组件不渲染任何内容，只负责处理通知逻辑 -->
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useNotification } from 'naive-ui'
import { useNotificationStore } from '@/renderer/store/notification.store'
import type { NotificationMessage } from '@/shared/types'
import { TimeUtil } from '@/shared/utils'

const notification = useNotification()
const notificationStore = useNotificationStore()

let notificationListener: ((notification: NotificationMessage) => void) | null = null

onMounted(() => {
  notificationListener = (notificationMsg: NotificationMessage) => {
    notificationStore.addNotification(notificationMsg)
    
    const levelToType: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
      'info': 'info',
      'success': 'success',
      'warning': 'warning',
      'error': 'error',
    }
    
    notification[levelToType[notificationMsg.level]]({
      content: notificationMsg.content,
      title: notificationMsg.title || '',
      description: notificationMsg.description || '',
      meta: notificationMsg.timestamp ? TimeUtil.format(notificationMsg.timestamp, 'yyyy-MM-dd HH:mm') : '',
      duration: notificationMsg.timeout || 2500,
    })
  }
  
  window.electronAPI.onNotification(notificationListener)
})

onUnmounted(() => {
  if (notificationListener) {
    window.electronAPI.removeNotificationListener?.()
  }
})
</script>