<template>
  <n-flex class="page-header">
    <!-- 标题 -->
    <n-text class="title">{{ title }}</n-text>

    <!-- 窗口控制按钮 -->
    <n-flex v-if="showWindowControls" class="window-controls">
      <n-button @click="handleMinimize" class="control-btn" :title="$t('ACTION.MINIMIZE')">
        <Remove />
      </n-button>
      <n-button @click="handleMaximize" class="control-btn"
        :title="isMaximized ? $t('ACTION.RESTORE') : $t('ACTION.MAXIMIZE')">
        <component :is="isMaximized ? Contract : Expand" />
      </n-button>
      <n-button @click="handleClose" class="control-btn close-btn" :title="$t('ACTION.CLOSE')">
        <Close />
      </n-button>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Remove, Expand, Contract, Close } from '@vicons/ionicons5'
import { i18n } from '@/renderer/plugins/i18n'

// Props 定义
interface Props {
  /** 页面标题 */
  title?: string
  /** 是否显示窗口控制按钮 */
  showWindowControls?: boolean
}

// 使用类型断言解决 i18n 实例的类型问题
const t = i18n.global.t as (key: string) => string | string[]

const appName = computed(() => t('APP.NAME') as string)
const welcome = computed(() => t('APP.WELCOME') as string)

const props = withDefaults(defineProps<Props>(), {
  title: appName.value + ' - ' + welcome.value,
  showWindowControls: true
})

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
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  user-select: none;
  -webkit-app-region: drag;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}

.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background-color: #f5f5f5;
}

.close-btn:hover {
  background-color: #ff4d4f;
  color: #fff;
}
</style>