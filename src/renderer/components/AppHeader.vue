<template>
  <n-flex class="page-header">
    <!-- 标题 -->
    <n-text class="title">{{ title }}</n-text>

    <!-- 窗口控制按钮 -->
    <n-flex class="window-controls">
      <n-button @click="handleMinimize" class="control-btn" text :title="$t('ACTION.MINIMIZE')">
        <n-icon><Remove /></n-icon>
      </n-button>
      <n-button @click="handleMaximize" class="control-btn" text :title="isMaximized ? $t('ACTION.RESTORE') : $t('ACTION.MAXIMIZE')">
        <n-icon v-if="isMaximized"><Contract /></n-icon>
        <n-icon v-else><Expand /></n-icon>
      </n-button>
      <n-button @click="handleClose" class="control-btn" text :title="$t('ACTION.CLOSE')">
        <n-icon><Close /></n-icon>
      </n-button>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Remove, Expand, Contract, Close } from '@vicons/ionicons5'
import { i18n } from '@/renderer/plugins/i18n'

// 使用类型断言解决 i18n 实例的类型问题
const t = i18n.global.t as (key: string) => string | string[]

const appName = computed(() => t('APP.NAME') as string)
const welcome = computed(() => t('APP.WELCOME') as string)

// 使用 computed 实现响应式标题，当语言切换时自动更新
const title = computed(() => `${appName.value} - ${welcome.value}`)

// 响应式数据
const isMaximized = ref(false)
const isElectron = computed(() => {
  return typeof window !== 'undefined' && !!window.electronAPI
})

// 方法
async function handleMinimize(): Promise<void> {
  if (isElectron.value) {
    await window.electronAPI.window.minimize()
  }
}

async function handleMaximize(): Promise<void> {
  if (isElectron.value) {
    await window.electronAPI.window.maximize()
    isMaximized.value = !isMaximized.value
  }
}

async function handleClose(): Promise<void> {
  if (isElectron.value) {
    await window.electronAPI.window.close()
  }
}

// 生命周期
onMounted(async () => {
  if (isElectron.value) {
    isMaximized.value = await window.electronAPI.window.isMaximized()
  }
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between !important;
  align-items: center;
  width: 100%;
  height: 30px;
  padding: 0 12px;
  user-select: none;
  -webkit-app-region: drag;
}

.title {
  font-size: 12px;
  /* font-weight: 600; */
}

.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.control-btn {
  font-size: 16px;
}

</style>