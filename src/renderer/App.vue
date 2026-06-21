<template>
  <n-config-provider :theme="currentTheme" :theme-overrides="naiveThemeOverrides" :locale="currentLocale"
    :date-locale="currentDateLocale">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <n-modal-provider>
            <router-view />
            <notification-handler />
          </n-modal-provider>
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
// App.vue 现在只负责渲染路由视图
// 布局和内容由路由组件处理
import { computed, onMounted, onUnmounted } from "vue";
import {
  darkTheme,
  zhCN,
  dateZhCN,
  enUS,
  dateEnUS,
  GlobalTheme,
} from "naive-ui";
import NotificationHandler from "@/renderer/components/NotificationHandler.vue";
import { initI18n } from "@/renderer/plugins/i18n";
import { useSystem, useConfig, useTheme, useModel } from "@/renderer/composables";
import { useDownloadStore } from "@/renderer/store/download.store";

const { activeMode, naiveThemeOverrides } = useTheme();

const { locale, isLoaded } = useConfig();
const downloadStore = useDownloadStore();

// 全局主题配置
// Naive UI 主题对象（配置加载后才应用，避免闪烁）
const currentTheme = computed<GlobalTheme | null>(() => {
  if (!isLoaded.value) return null;
  return activeMode.value === "dark" ? darkTheme : null;
});

// 全局语言配置
const currentLocale = computed(() => {
  return locale.value === "zhCN" ? zhCN : enUS;
});

const currentDateLocale = computed(() => {
  return locale.value === "zhCN" ? dateZhCN : dateEnUS;
});

onMounted(async () => {
  // 初始化系统信息（确保配置已加载）
  await useSystem().init();

  // 初始化模型配置
  await useModel({ autoInit: false }).init();

  // 初始化 i18n，传入配置的语言
  await initI18n();

  // 启动下载进度监听
  downloadStore.setupListeners();
});

onUnmounted(() => {
  downloadStore.destroyListeners();
});
</script>

<style>
/* 全局样式已在 main.ts 中导入 */
.n-config-provider {
  height: 100vh;
}
</style>
