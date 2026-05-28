<template>
  <n-flex vertical class="app-container">
    <AppHeader v-model:menuVisible="menuVisible" />
    <n-layout class="layout-container" has-sider>
      <n-layout-sider bordered :width="200" :collapsed-width="64" :collapse-mode="'width'" :collapsed="menuVisible"
        class="sidebar">
        <n-flex vertical class="menu-container-main">
          <n-menu :options="menuOptions" v-model:value="selectedKey" :collapsed="menuVisible" :collapsed-width="64"
            :collapsed-icon-size="20" :icon-size="18" mode="vertical" @update:value="handleMenuClick" />
        </n-flex>
        <!-- 
      <n-flex vertical class="new-button-container">
        <n-popover trigger="click" placement="top-start" :show-arrow="false">
          <template #trigger>
            <n-button block type="primary" dashed>
              <template #icon>
                <n-icon><Add /></n-icon>
              </template>
{{ t("ACTION.COMMON.CREATE") }}
</n-button>
</template>
<n-flex vertical class="new-popover-content">
  <template v-for="option in newOptions" :key="option.key">
              <n-button
                block
                quaternary
                size="small"
                :disabled="option.disabled"
              >
                {{ option.label }}
              </n-button>
            </template>
</n-flex>
</n-popover>
</n-flex> -->
      </n-layout-sider>

      <n-layout class="content-container">
        <router-view />
      </n-layout>
    </n-layout>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { MenuOption } from "naive-ui";
import { NIcon } from "naive-ui";
import type { Component } from "vue";
import { Book, TodayOutline, Add, ChatbubbleEllipsesOutline } from "@vicons/ionicons5";
import AppHeader from "../components/AppHeader.vue";

const { t } = useI18n();
const router = useRouter();

const menuVisible = ref(true);
const selectedKey = ref("");

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) });
}

const menuOptions = computed<MenuOption[]>(() => [
  {
    label: t("APP.BASE.CAPTURE"),
    key: "capture",
    icon: renderIcon(TodayOutline),
  },
  {
    label: t("APP.BASE.CHAT"),
    key: "chat",
    icon: renderIcon(ChatbubbleEllipsesOutline),
  },
]);

const routeConfigMap: Record<string, { key: string; path: string }> = {
  capture: { key: "capture", path: "/capture" },
  think: { key: "think", path: "/think" },
  create: { key: "create", path: "/create" },
  chat: { key: "chat", path: "/chat" },
};

const handleMenuClick = (key: string) => {
  router.push(routeConfigMap[key].path);
};
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.app-container {
  height: 100%;
  width: 100%;
  gap: 0 !important;
}

.layout-container {
  height: calc(100% - $spacing-xl);
}

.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.menu-container-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  align-items: flex-start;
  margin-top: $spacing-md;

  .n-menu {
    width: 100%;
  }
}

.content-container {
  height: 100%;
}
</style>
