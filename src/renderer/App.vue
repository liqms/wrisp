<template>
  <n-config-provider :theme="globalTheme">
    <n-message-provider>
      <n-dialog-provider>
        <n-modal-provider>
          <n-notification-provider>
            <router-view />
            <notification-handler />
          </n-notification-provider>
        </n-modal-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
// App.vue 现在只负责渲染路由视图
// 布局和内容由路由组件处理
import { computed, watch, onMounted } from 'vue'
import { LocaleEnum, ThemeEnum } from '@/shared/enums';
import { darkTheme } from 'naive-ui';
import type { GlobalTheme } from 'naive-ui';
import NotificationHandler from '@/renderer/components/NotificationHandler.vue';
import { initI18n } from '@/renderer/plugins/i18n';
import { useSystem,useConfig } from '@/renderer/composables';

const { theme } = useConfig();

// 全局主题配置
const globalTheme = computed<GlobalTheme | null>(() => {
  return theme.value == ThemeEnum.DARK ? darkTheme : null
})

// 更新 html 的 data-theme 属性
const updateHtmlTheme = (themeValue: string) => {
  const html = document.documentElement;
  if (themeValue == ThemeEnum.DARK) {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }
}


onMounted(async () => {
  // 初始化系统信息（确保配置已加载）
  await useSystem().init();
  
  // 初始化 i18n，传入配置的语言
  await initI18n();
  
  // 其他初始化逻辑
  if (theme.value) {
    updateHtmlTheme(theme.value);
  }
});

watch(theme, (newTheme) => {
  if (newTheme) {
    updateHtmlTheme(newTheme);
  }
})

</script>

<style>
/* 全局样式已在 main.ts 中导入 */
.n-config-provider {
  height: 100vh;
}
</style>
