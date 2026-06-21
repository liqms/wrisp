<template>
  <n-button @click="sendTestNotification">
    发送测试通知
  </n-button>
</template>

<script setup lang="ts">
import { useFrontendNotification } from "../../composables/useNotification";
import { NotificationOptions } from "../../composables/useNotification"
const notification: NotificationOptions = {
  title: "测试通知",
  content: "这是一条测试通知",
}
function sendTestNotification() {
  useFrontendNotification(notification).info(notification.title, notification.content);
}



</script>

<style scoped lang="scss"></style>
