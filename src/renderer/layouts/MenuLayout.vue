<template>
  <n-layout has-sider>
    <n-layout-sider
      bordered
      :width="200"
      :collapsed-width="64"
      :collapse-mode="'width'"
      v-model:collapsed="isCollapsed"
      align="center"
      class="sidebar"
    >
      <n-flex justify="center" align="center" class="logo-container">
        <n-avatar :src="logoPath" round size="medium" object-fit="cover" />
      </n-flex>
      <n-flex vertical class="menu-container-main">
        <n-menu
          :options="menuOptions"
          v-model:value="selectedKey"
          :collapsed="isCollapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          mode="vertical"
          @update:value="handleMenuClick"
        />
      </n-flex>
      <n-flex vertical class="menu-container">
        <n-menu
          :options="menuOptionsSec"
          v-model:value="selectedKey"
          :collapsed="isCollapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          mode="vertical"
          @update:value="handleMenuClick"
        />
      </n-flex>
    </n-layout-sider>

    <n-layout class="content-container">
      <n-layout-header class="content-header">
        <n-flex class="title-container">
          <n-text class="title">{{ selectedLabel }}</n-text>
        </n-flex>
        <n-flex class="button-container">
          <n-button quaternary class="window-button minimize-button" @click="handleMinimize">
            <template #icon>
              <RemoveOutline />
            </template>
          </n-button>
          <n-button quaternary class="window-button maximize-button" @click="handleMaximize">
            <template #icon>
              <component :is="maximizeIcon" />
            </template>
          </n-button>
          <n-button quaternary class="window-button close-button" @click="handleClose">
            <template #icon>
              <CloseOutline />
            </template>
          </n-button>
        </n-flex>
      </n-layout-header>

      <n-layout-content>
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, h, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { MenuOption } from 'naive-ui'
import type { Component } from 'vue'
import { NIcon } from 'naive-ui'
import { useConfig } from '../composables'
import {
  HomeOutline,
  SettingsOutline,
  TimerOutline,
  CreateOutline,
  CloseOutline,
  RemoveOutline,
  ResizeOutline,
  ContractOutline
} from '@vicons/ionicons5'

const router = useRouter()
const configStore = useConfig()

const isCollapsed = ref(true)
const isMaximized = ref(false)
const logoPath = ref('')
const selectedKey = ref('home')

interface RouteConfig {
  key: string
  label: string
  path: string
}

const routeConfigMap: Record<string, RouteConfig> = {
  chat: { key: 'chat', label: 'AI对话', path: '/chat' },
  create: { key: 'create', label: '创作', path: '/create' },
  history: { key: 'history', label: '历史记录', path: '/history' },
  settings: { key: 'settings', label: '设置', path: '/settings' }
}

const selectedLabel = computed(() => {
  const route = Object.values(routeConfigMap).find(r => r.key === selectedKey.value)
  return route?.label || 'AI对话'
})

const maximizeIcon = computed((): Component => {
  return isMaximized.value ? ContractOutline : ResizeOutline
})

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const menuOptions: MenuOption[] = [
  {
    label: 'AI对话',
    key: 'chat',
    icon: renderIcon(HomeOutline)
  },
  {
    label: '创作',
    key: 'create',
    icon: renderIcon(CreateOutline)
  }
]

const menuOptionsSec: MenuOption[] = [
  {
    label: '历史记录',
    key: 'history',
    icon: renderIcon(TimerOutline)
  },
  {
    label: '设置',
    key: 'settings',
    icon: renderIcon(SettingsOutline)
  }
]

const handleMenuClick = (key: string) => {
  const route = routeConfigMap[key]
  if (route) {
    router.push(route.path)
  }
}

watch(() => router.currentRoute.value.path, (newPath) => {
  const route = Object.values(routeConfigMap).find(r => r.path === newPath)
  if (route) {
    selectedKey.value = route.key
  }
})

const handleMinimize = async () => {
  try {
    await window.electronAPI.window.minimize()
  } catch (error) {
    console.error('最小化窗口失败:', error)
  }
}

const handleMaximize = async () => {
  try {
    await window.electronAPI.window.maximize()
    isMaximized.value = await window.electronAPI.window.isMaximized()
  } catch (error) {
    console.error('最大化/还原窗口失败:', error)
  }
}

const handleClose = async () => {
  try {
    await window.electronAPI.window.close()
  } catch (error) {
    console.error('关闭窗口失败:', error)
  }
}

onMounted(async () => {
  const basePath = await configStore.getStaticPath();
  logoPath.value = basePath + 'logos/pentip.png'; 

  try {
    isMaximized.value = await window.electronAPI.window.isMaximized()
  } catch (error) {
    console.error('获取窗口状态失败:', error)
  }
})
</script>

<style scoped lang="scss">
@use '../styles/_variables' as *;

.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.logo-container {
  display: flex;
  height: 64px;
  padding: 15px;
}

.menu-container-main {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px - 102px);
}

.menu-container {
  display: flex;
  flex-direction: column;
  height: 102px;
}

.content-container {
  height: 100vh;
}

.n-layout-header {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 15px;
}

.n-layout-content {
  height: calc(100vh - 44px);
}


.title-container {
  flex: 1;
  height: 44px;
  align-items: center;
}

.title {
  font-size: 16px;
  font-weight: bold;
}

.button-container {
  display: flex;
  height: 44px;
  align-items: center;
}

.window-button {
  height: 32px;
  width: 32px;
  padding: 0;
  transition: all $transition-base ease;

  &:hover {
    background-color: rgba(0, 0, 0, 0.08);
    transform: scale(1.1);
  }
}

.close-button:hover {
  background-color: rgba(255, 77, 79, 0.9) !important;

  svg {
    color: #fff;
  }
}
</style>
