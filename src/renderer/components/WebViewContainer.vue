<template>
  <n-flex class="webview-container">
    <!-- 错误状态 -->
    <n-flex v-if="hasError" class="webview-error">
      <n-result status="error" :title="$t('TIPS.WEBVIEW_ERROR')" :description="errorMessage || ''" size="small">
        <template #footer>
          <n-space justify="center">
            <n-button @click="retry">
              {{ $t('ACTION.RETRY') }}
            </n-button>
          </n-space>
        </template>
      </n-result>
    </n-flex>

    <!-- WebView 容器 -->
    <n-flex v-else-if="isReady" ref="webviewContainerRef" class="webview-content">
      <!-- WebView 将通过 Electron API 渲染在这里 -->
    </n-flex>
    <!-- WebView 标签 -->
    <webview ref="webviewRef" :src="props.url" class="webview" />
  </n-flex>
</template>

<script setup lang="ts">
import { watch, onMounted, ref, onUnmounted } from 'vue'
import { NButton, NResult, NSpace } from 'naive-ui'
import { useWebView } from '@/renderer/composables/useWebView'
import { logger } from '@/renderer/utils/logger.utils'
import { WebContentViewOptions } from '@/shared/types'

// Props 定义
interface Props {
  /** 要加载的 URL */
  url: string
  /** 是否自动调整位置和大小 */
  autoAdjustBounds?: boolean
  x?: number
  /** WebView 内容视图 Y 坐标 */
  y?: number
  /** WebView 内容视图宽度 */
  width?: number
  /** WebView 内容视图高度 */
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoAdjustBounds: true,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
})

const webviewBounds = ref<WebContentViewOptions>({
  x: props.x,
  y: props.y,
  width: props.width,
  height: props.height
})

// 路由实例

// 使用组合函数
const {
  hasError,
  errorMessage,
  isReady,
  loadWebView,
  resize,
  destroy,
  retry,
  init
} = useWebView({
  initialUrl: props.url,
  webContentViewOptions: webviewBounds.value
})
// 更新 webview 位置和大小
const webviewContainerRef = ref<{ $el?: HTMLElement } | null>(null)
const webviewRef = ref(null)
let resizeObserver: ResizeObserver | null = null
function updateWebviewBounds() {
  const el = webviewContainerRef.value
  const webview = webviewRef.value
  if (!el || !webview) return

  // 获取原生 DOM 元素（处理 Vue 组件引用的情况）
  const domEl = el.$el || el
  if (!(domEl instanceof HTMLElement)) return

  // 获取区域在视口中的坐标
  const rect = domEl.getBoundingClientRect()
  logger.debug('更新 WebView 位置和大小', { x: rect.left, y: rect.top, width: rect.width, height: rect.height })
  if (props.autoAdjustBounds) {
    webviewBounds.value = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    }
  }
}

// 监听 props.url 变化
watch(
  () => props.url,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      loadWebView(newUrl, webviewBounds.value)
    }
  }
)

// 监听 内容视图变化
watch(
  () => webviewBounds.value,
  (newBounds, oldBounds) => {
    if (newBounds !== oldBounds) {
      resize(newBounds)
    }
  }
)

// 生命周期
onMounted(() => {
  init()
  // 初始定位
  updateWebviewBounds()

  // 用 ResizeObserver 监听容器大小/位置变化（侧边栏展开收起等布局变动）
  const containerEl = webviewContainerRef.value?.$el || webviewContainerRef.value
  resizeObserver = new ResizeObserver(() => {
    updateWebviewBounds()
  })
  if (containerEl instanceof HTMLElement) {
    resizeObserver.observe(containerEl)
  }
  // 窗口大小变化时重新计算（后备）
  window.addEventListener('resize', updateWebviewBounds)
})

// 使用 onUnmounted 确保离开页面时隐藏 WebView
onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', updateWebviewBounds)
  // 确保隐藏 WebView
  destroy()
})
</script>

<style lang="scss" scoped>
@use '@/renderer/styles/_variables.scss' as *;

.webview-container {
  width: 100%;
  height: calc(100% - 50px);
  border: 1px solid var(--border-color);
  border-radius: $radius-sm;
  overflow: hidden;
  flex-direction: column !important;
}

.webview-error {
  align-items: center;
  justify-content: center;
  min-height: 200px;
  margin: auto;
}

.webview-content {
  flex: 1;
  overflow: hidden;
}

.webview {
  /* 初始占位，实际由 bounds 控制 */
  position: absolute;
  top: 0;
  left: 0;
}
</style>