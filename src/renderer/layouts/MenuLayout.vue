<template>
  <AppHeader />
  <n-layout class="layout-container" has-sider>
    <n-layout-sider
      bordered
      :width="200"
      :collapsed-width="64"
      :collapse-mode="'width'"
      v-model:collapsed="isCollapsed"
      align="center"
      class="sidebar"
    >
      <n-flex justify="center" align="center" class="user-container">
        <n-avatar :src="userAvatarPath" round size="medium" object-fit="cover" />
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
      <n-layout-content class="main-content">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, h, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { MenuOption } from 'naive-ui'
import type { Component } from 'vue'
import { NIcon } from 'naive-ui'
import { useConfig } from '../composables'
import AppHeader from '../components/AppHeader.vue'
import {
  Home,
  Settings,
  Albums,
  Bookmarks
} from '@vicons/ionicons5'

// 使用 useI18n 获取响应式的翻译函数
const { t } = useI18n()

const router = useRouter()
const configStore = useConfig()

const isCollapsed = ref(true)
const userAvatarPath = ref('')
const selectedKey = ref('home')

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

// 使用 computed 确保菜单选项响应语言变化
const menuOptions = computed<MenuOption[]>(() => [
  {
    label: t('APP.HOME'),
    key: 'home',
    icon: renderIcon(Home)
  },
  {
    label: t('APP.KNOWLEDGE'),
    key: 'knowledge',
    icon: renderIcon(Bookmarks)
  },
  {
    label: t('APP.CREATION'),
    key: 'creation',
    icon: renderIcon(Albums)
  }
])

const menuOptionsSec = computed<MenuOption[]>(() => [
  {
    label: t('APP.SETTINGS'),
    key: 'settings',
    icon: renderIcon(Settings)
  }
])

// 路由配置映射
const routeConfigMap: Record<string, { key: string; path: string }> = {
  home: { key: 'home', path: '/home' },
  knowledge: { key: 'knowledge', path: '/knowledge' },
  creation: { key: 'creation', path: '/creation' },
  settings: { key: 'settings', path: '/settings' }
}

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

// 动态获取头像路径
onMounted(async () => {
  const userAvatar = await configStore.getValue('userInfo.avatar')
  // 使用 app://cache/ 协议访问用户缓存资源
  if (userAvatar) {
    userAvatarPath.value = `app://cache/${userAvatar}`
  } else {
    userAvatarPath.value = 'app://avatar/default.png'
  }
})

</script>

<style scoped lang="scss">
@use '../styles/_variables' as *;

.layout-container {
  height: calc(100vh - 30px);
}



.sidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.user-container {
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
