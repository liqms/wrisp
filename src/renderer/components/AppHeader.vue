<template>
  <n-flex class="page-header">
    <!-- 左侧按钮 -->
    <n-flex class="controls-wrapper">
      <n-button @click="handleMenuClick" class="control-btn" text :title="$t('APP.BASE.MENU')">
        <n-icon>
          <Menu />
        </n-icon>
      </n-button>
    </n-flex>

    <!-- 标题 -->
    <n-text class="title">{{ title }}</n-text>

    <!-- 窗口控制按钮 -->
    <n-flex class="controls-wrapper">
      <n-button class="control-btn" text :title="$t('APP.BASE.SETTINGS')" @click="handleSettingsClick">
        <n-icon>
          <SettingsOutline />
        </n-icon>
      </n-button>
      <n-divider vertical />
      <n-button @click="handleMinimize" class="control-btn" text :title="$t('ACTION.WINDOW.MINIMIZE')">
        <n-icon>
          <Remove />
        </n-icon>
      </n-button>
      <n-button @click="handleMaximize" class="control-btn" text :title="isMaximized
        ? $t('ACTION.WINDOW.RESTORE')
        : $t('ACTION.WINDOW.MAXIMIZE')
        ">
        <n-icon v-if="isMaximized">
          <Contract />
        </n-icon>
        <n-icon v-else>
          <Expand />
        </n-icon>
      </n-button>
      <n-button @click="handleClose" class="control-btn" text :title="$t('ACTION.WINDOW.CLOSE')">
        <n-icon>
          <Close />
        </n-icon>
      </n-button>
    </n-flex>
  </n-flex>
  <SettingsView v-model:show="showSettings" @close="handleCloseSettings" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  Remove,
  Expand,
  Contract,
  Close,
  SettingsOutline,
  Menu,
} from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";
import SettingsView from "@/renderer/components/SettingsView.vue";

const { t } = useI18n();

// Props
const props = defineProps<{
  menuVisible?: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: "update:menuVisible", value: boolean): void;
}>();

const appName = computed(() => t("APP.BASE.NAME") as string);
const slogan = computed(() => t("APP.BASE.SLOGAN") as string);

// 使用 computed 实现响应式标题，当语言切换时自动更新
const title = computed(() => `${appName.value} - ${slogan.value}`);

// 响应式数据
const isMaximized = ref(false);
const showSettings = ref(false);
const isElectron = computed(() => {
  return typeof window !== "undefined" && !!window.electronAPI;
});

// 方法
function handleMenuClick(): void {
  emit("update:menuVisible", !props.menuVisible);
}

function handleSettingsClick(): void {
  showSettings.value = true;
}

function handleCloseSettings(): void {
  showSettings.value = false;
}

async function handleMinimize(): Promise<void> {
  if (isElectron.value) {
    await window.electronAPI.window.minimize();
  }
}

async function handleMaximize(): Promise<void> {
  if (isElectron.value) {
    await window.electronAPI.window.maximize();
    isMaximized.value = !isMaximized.value;
  }
}

async function handleClose(): Promise<void> {
  if (isElectron.value) {
    await window.electronAPI.window.close();
  }
}

// 生命周期
onMounted(async () => {
  if (isElectron.value) {
    isMaximized.value = await window.electronAPI.window.isMaximized();
  }
});
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables.scss" as *;

.page-header {
  justify-content: space-between !important;
  align-items: center;
  width: 100%;
  height: $spacing-xl;
  padding: 0 $spacing-md;
  user-select: none;
  -webkit-app-region: drag;
  background-color: var(--bg-secondary);
}

.title {
  font-size: $font-xs;
  flex: 1;
  color: var(--text-quaternary);
}

.controls-wrapper {
  display: flex;
  gap: $spacing-sm;
  -webkit-app-region: no-drag;
}

.control-btn {
  font-size: $font-sm;
}
</style>
