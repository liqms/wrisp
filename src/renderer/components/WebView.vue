<template>
  <n-flex class="webview-container">
    <!-- 工具栏 -->
    <n-flex v-if="showToolbar" class="webview-toolbar">
      <n-flex class="toolbar-left">
        <n-button quaternary size="small" :disabled="!canGoBack" @click="goBack" :title="$t('ACTION.BACK')">
          <template #icon>
            <n-icon size="20">
              <ArrowBack />
            </n-icon>
          </template>
        </n-button>
        <n-button quaternary size="small" :disabled="!canGoForward" @click="goForward" :title="$t('ACTION.FORWARD')">
          <template #icon>
            <n-icon size="20">
              <ArrowForward />
            </n-icon>
          </template>
        </n-button>
        <n-button quaternary size="small" @click="reload" :title="$t('ACTION.REFRESH')">
          <template #icon>
            <n-icon size="20">
              <Refresh />
            </n-icon>
          </template>
        </n-button>
      </n-flex>

      <n-flex class="toolbar-center">
        <n-input v-model:value="currentUrl" size="small" :placeholder="$t('PLACEHOLDER.INPUT_URL')" clearable>
          <template #suffix>
            <n-button size="small" type="primary" @click="handleUrlChange(currentUrl)" :loading="loading">
              {{ $t('ACTION.GO') }}
            </n-button>
          </template>
        </n-input>
      </n-flex>

      <n-flex class="toolbar-right">
        <n-button quaternary size="small" @click="openExternal" :title="$t('ACTION.OPEN_EXTERNAL')">
          <template #icon>
            <n-icon size="20">
              <Open />
            </n-icon>
          </template>
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 加载状态 -->
    <n-flex v-if="loading" class="webview-loading">
      <n-spin size="small">
        <template #description>
          {{ $t('TIPS.WEBVIEW_LOADING') }}
        </template>
      </n-spin>
    </n-flex>

    <!-- 错误状态 -->
    <n-flex v-else-if="error" class="webview-error">
      <n-result status="error" :title="$t('TIPS.WEBVIEW_ERROR')" :description="error" size="small">
        <template #footer>
          <n-space justify="center">
            <n-button @click="retry">
              {{ $t('ACTION.RETRY') }}
            </n-button>
            <n-button @click="openExternal">
              {{ $t('ACTION.OPEN_EXTERNAL') }}
            </n-button>
          </n-space>
        </template>
      </n-result>
    </n-flex>

    <!-- WebView 容器 -->
    <n-flex v-else-if="isReady" ref="webviewContainer" class="webview-content" :class="{ 'with-toolbar': showToolbar }">
      <!-- WebView 将通过 Electron API 渲染在这里 -->
      <n-flex v-if="!isElectron" class="webview-fallback">
        <n-result status="warning" :title="$t('TIPS.WEBVIEW_UNAVAILABLE')" size="small">
          <template #footer>
            <n-button @click="openExternal">
              {{ $t('ACTION.OPEN_EXTERNAL') }}
            </n-button>
          </template>
        </n-result>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { watch, onMounted, ref } from 'vue'
import { NButton, NIcon, NInput, NSpin, NResult, NSpace } from 'naive-ui'
import { ArrowBack, ArrowForward, Refresh, Open } from '@vicons/ionicons5'
import { useWebView } from '@/renderer/composables/useWebView'
import { logger } from '@/renderer/utils/logger.utils'
import { WebContentViewOptions } from '@/shared/types'

// Props 定义
interface Props {
  /** 要加载的 URL */
  url: string
  /** 是否显示工具栏 */
  showToolbar?: boolean
  /** 是否自动加载 */
  autoLoad?: boolean
  /** WebView 内容视图 X 坐标 */
  x?: number
  /** WebView 内容视图 Y 坐标 */
  y?: number
  /** WebView 内容视图宽度 */
  width?: number
  /** WebView 内容视图高度 */
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  showToolbar: true,
  autoLoad: true,
  x: 0,
  y: 0,
  width: 800,
  height: 600
})

// Emits 定义
const emit = defineEmits<{
  /** WebView 加载完成 */
  loaded: [url: string]
  /** WebView 加载失败 */
  error: [error: string, url: string]
  /** URL 发生变化 */
  urlChange: [newUrl: string, oldUrl: string]
  /** 导航状态变化 */
  navigationChange: [canGoBack: boolean, canGoForward: boolean]
}>()

// 计算 WebView 内容视图选项（根据 props 计算，不使用响应式）
const getWebContentViewOptions = (): WebContentViewOptions => ({
  x: props.x,
  y: props.showToolbar ? props.y + 40 : props.y,
  width: props.width,
  height: props.showToolbar ? props.height - 40 : props.height
})

// 使用组合函数
const {
  loading,
  error,
  currentUrl,
  canGoBack,
  canGoForward,
  isElectron,
  isReady,
  loadWebView,
  reload,
  goBack,
  goForward,
  handleUrlChange,
  retry,
  openExternal,
  init
} = useWebView({
  initialUrl: props.url,
  autoLoad: props.autoLoad,
  showToolbar: props.showToolbar,
  webContentViewOptions: getWebContentViewOptions()
})

// 事件监听
watch(() => error, (newError) => {
  if (newError) {
    emit('error', newError, currentUrl)
  }
})

watch(() => currentUrl, (newUrl, oldUrl) => {
  if (newUrl !== oldUrl) {
    emit('urlChange', newUrl, oldUrl)
  }
})

watch([() => canGoBack, () => canGoForward], ([newCanGoBack, newCanGoForward]) => {
  emit('navigationChange', newCanGoBack, newCanGoForward)
})

// 监听 props.url 变化
watch(
  () => props.url,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl && props.autoLoad) {
      loadWebView(newUrl, getWebContentViewOptions())
    }
  }
)

// 生命周期
onMounted(() => {
  // 创建纯对象副本，避免 IPC 序列化问题
  const optionsCopy = { ...getWebContentViewOptions() }
  logger.info('前端 WebView 初始化完成', { url: props.url, showToolbar: props.showToolbar, webContentViewOptions: optionsCopy })
  init()
})
</script>

<style scoped>
.webview-container {
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  flex-direction: column !important;
}

.webview-toolbar {
  align-items: center;
  padding: 2px;
  border-bottom: 1px solid var(--border-color);
  width: 100%;
  height: fit-content;

  .n-icon {
    color: var(--text-primary);
  }
}

.toolbar-left,
.toolbar-right {
  gap: 2px !important;
  align-items: center;
}

.toolbar-center {
  flex: 1;
  margin: 0 8px !important;
}

.webview-loading,
.webview-error,
.webview-fallback {
  align-items: center;
  justify-content: center;
  min-height: 200px;
  margin: auto;

}

.webview-content {
  flex: 1;
  overflow: hidden;
}

.webview-content.with-toolbar {
  height: calc(100% - 48px);
}
</style>