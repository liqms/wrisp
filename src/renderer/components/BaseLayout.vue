<template>
  <n-layout class="base-layout">
    <n-layout-header bordered class="header">
      <n-space justify="space-between" align="center">
        <n-space align="center">
          <n-icon size="28" color="#2080f0">
            <PenTipIcon />
          </n-icon>
          <n-h2 style="margin: 0; color: white">PenTip - 智能创作助手</n-h2>
        </n-space>
        
        <n-menu
          mode="horizontal"
          :options="menuOptions"
          :value="activeKey"
          @update:value="handleMenuSelect"
        />
        
        <n-space align="center">
          <LocaleSwitcher />
          <n-button text @click="toggleDarkMode">
            <template #icon>
              <n-icon>
                <MoonOutline v-if="isDarkMode" />
                <SunnyOutline v-else />
              </n-icon>
            </template>
          </n-button>
        </n-space>
      </n-space>
    </n-layout-header>
    
    <n-layout-content class="main">
      <router-view />
    </n-layout-content>
    
    <n-layout-footer bordered class="footer">
      <n-space justify="center" align="center">
        <n-text depth="3">&copy; 2024 PenTip. All rights reserved.</n-text>
        <n-text depth="3">基于 Electron + Vue 3 + Naive UI</n-text>
      </n-space>
    </n-layout-footer>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  NLayout, 
  NLayoutHeader, 
  NLayoutContent, 
  NLayoutFooter,
  NSpace,
  NIcon,
  NH2,
  NMenu,
  NButton,
  NText
} from 'naive-ui'
import { 
  CreateOutline as PenTipIcon,
  MoonOutline,
  SunnyOutline
} from '@vicons/ionicons5'
import LocaleSwitcher from './LocaleSwitcher.vue'

const route = useRoute()
const router = useRouter()
const isDarkMode = ref(false)

const menuOptions = [
  {
    label: '首页',
    key: '/',
    icon: () => h('div', '🏠')
  },
  {
    label: '作品管理',
    key: '/works',
    icon: () => h('div', '📁')
  },
  {
    label: 'AI对话',
    key: '/chat',
    icon: () => h('div', '💬')
  },
  {
    label: '设置',
    key: '/settings',
    icon: () => h('div', '⚙️')
  },
  {
    label: '关于',
    key: '/about',
    icon: () => h('div', 'ℹ️')
  }
]

const activeKey = computed(() => route.path)

const handleMenuSelect = (key: string) => {
  router.push(key)
}

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  // 这里可以添加切换暗色模式的逻辑
  console.log('Dark mode:', isDarkMode.value)
}
</script>

<style scoped>
.base-layout {
  min-height: 100vh;
}

.header {
  padding: 0 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header :deep(.n-menu) {
  background: transparent;
}

.header :deep(.n-menu .n-menu-item) {
  color: rgba(255, 255, 255, 0.9);
}

.header :deep(.n-menu .n-menu-item.n-menu-item--selected) {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.header :deep(.n-menu .n-menu-item:hover) {
  background: rgba(255, 255, 255, 0.05);
}

.main {
  padding: 24px;
  background-color: #f8f9fa;
  min-height: calc(100vh - 64px - 48px); /* 减去 header 和 footer 的高度 */
}

.footer {
  padding: 12px 24px;
  background-color: #f0f2f5;
}
</style>
