<template>
  <n-flex class="page-header">
    <!-- 左侧按钮 -->
    <n-flex class="controls-wrapper">
      <n-button class="control-btn" text :title="$t('APP.BASE.MENU')" @click="handleMenuClick">
        <n-icon size="14">
          <MenuOutlined />
        </n-icon>
      </n-button>
    </n-flex>

    <!-- 标题 -->
    <n-text class="title">{{ title }}</n-text>

    <!-- 下载进度按钮 -->
    <n-popover v-if="isDownloadActive" trigger="click" placement="bottom-end" class="download-progress-popover">
      <template #trigger>
        <n-button class="control-btn" text :title="$t('DOWNLOAD.TITLE')">
          <n-badge :value="activeDownloadCount" dot>
            <n-icon size="17">
              <FileDownloadOutlined />
            </n-icon>
          </n-badge>
        </n-button>
      </template>
      <DownloadProgressPanel />
    </n-popover>

    <!-- 窗口控制按钮 -->
    <n-flex class="controls-wrapper">
      <n-button class="control-btn" text :title="$t('APP.BASE.SETTINGS')" @click="handleSettingsClick">
        <n-icon size="14">
          <SettingsOutlined />
        </n-icon>
      </n-button>
      <n-divider vertical />
      <n-button class="control-btn" text :title="$t('ACTION.WINDOW.MINIMIZE')" @click="handleMinimize">
        <n-icon size="14">
          <MinimizeOutlined />
        </n-icon>
      </n-button>
      <n-button class="control-btn" text :title="isMaximized
        ? $t('ACTION.WINDOW.RESTORE')
        : $t('ACTION.WINDOW.MAXIMIZE')
        " @click="handleMaximize">
        <n-icon v-if="isMaximized" size="14">
          <FullscreenExitOutlined />
        </n-icon>
        <n-icon v-else size="14">
          <FullscreenOutlined />
        </n-icon>
      </n-button>
      <n-button class="control-btn" text :title="$t('ACTION.WINDOW.CLOSE')" @click="handleClose">
        <n-icon size="14">
          <CloseOutlined />
        </n-icon>
      </n-button>
    </n-flex>
  </n-flex>
  <SettingsView v-model:show="showSettings" @close="handleCloseSettings" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  MinimizeOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CloseOutlined,
  SettingsOutlined,
  MenuOutlined,
  FileDownloadOutlined,
} from "@vicons/material";
import { useI18n } from "vue-i18n";
import SettingsView from "@/renderer/components/SettingsView.vue";
import DownloadProgressPanel from "@/renderer/components/base/DownloadProgressPanel.vue";
import { useDownloadStore } from "@/renderer/store/download.store";
import { useShortcut } from "@/renderer/composables/useShortcut";

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
// 设置弹窗可见性由 shortcut store 统一管理（设置按钮与快捷键共用）
const shortcut = useShortcut();
const showSettings = computed({
  get: () => shortcut.settingsVisible,
  set: (value: boolean) => {
    shortcut.settingsVisible = value;
  },
});
const isElectron = computed(() => {
  return typeof window !== "undefined" && !!window.electronAPI;
});

// 下载进度
const downloadStore = useDownloadStore();
const isDownloadActive = computed(() => downloadStore.hasActiveDownloads);
// const isDownloadActive = ref(true);
const activeDownloadCount = computed(() => {
  let count = 0;
  for (const group of downloadStore.allGroupsProgress) {
    if (!group) continue;
    for (const file of group.files) {
      if (file.status === "downloading" || file.status === "pending") {
        count++;
      }
    }
  }
  return count;
});

// 方法
function handleMenuClick(): void {
  emit("update:menuVisible", !props.menuVisible);
}

function handleSettingsClick(): void {
  shortcut.openSettings();
}

function handleCloseSettings(): void {
  shortcut.closeSettings();
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

.download-progress-popover {
  margin-right: $spacing-sm;
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
