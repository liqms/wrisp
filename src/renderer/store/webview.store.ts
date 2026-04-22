import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ErrorCode } from '@/shared/enums'
import { getErrorMessage } from '@/renderer/utils/error.utils'

export const useWebViewStore = defineStore('webview', () => {
  // 状态
  const loading = ref(false)
  const errorCode = ref<ErrorCode | null>(null)
  const errorMessage = ref<string | null>(null)
  const currentUrl = ref('')
  const canGoBack = ref(false)
  const canGoForward = ref(false)
  const navigationHistory = ref<string[]>([])
  const currentHistoryIndex = ref(-1)

  // 计算属性
  const hasError = computed(() => errorCode.value !== null)
  const isReady = computed(() => !loading.value && !hasError.value)
  const canNavigate = computed(() => navigationHistory.value.length > 0)

  // 操作方法
  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (code: ErrorCode | null, message?: string) => {
    errorCode.value = code
    errorMessage.value = message || getErrorMessage(code)
  }

  const clearError = () => {
    errorCode.value = null
    errorMessage.value = null
  }

  const setCurrentUrl = (url: string) => {
    currentUrl.value = url
  }

  const setNavigationState = (back: boolean, forward: boolean) => {
    canGoBack.value = back
    canGoForward.value = forward
  }

  const addToHistory = (url: string) => {
    // 如果当前不是历史记录中的最新页面，清除后面的历史
    if (currentHistoryIndex.value < navigationHistory.value.length - 1) {
      navigationHistory.value = navigationHistory.value.slice(0, currentHistoryIndex.value + 1)
    }
    
    navigationHistory.value.push(url)
    currentHistoryIndex.value = navigationHistory.value.length - 1
  }

  const goBack = () => {
    if (currentHistoryIndex.value > 0) {
      currentHistoryIndex.value--
      return navigationHistory.value[currentHistoryIndex.value]
    }
    return null
  }

  const goForward = () => {
    if (currentHistoryIndex.value < navigationHistory.value.length - 1) {
      currentHistoryIndex.value++
      return navigationHistory.value[currentHistoryIndex.value]
    }
    return null
  }

  const clearHistory = () => {
    navigationHistory.value = []
    currentHistoryIndex.value = -1
  }

  return {
    // 状态
    loading,
    errorCode,
    errorMessage,
    currentUrl,
    canGoBack,
    canGoForward,
    navigationHistory,
    currentHistoryIndex,

    // 计算属性
    hasError,
    isReady,
    canNavigate,

    // 方法
    setLoading,
    setError,
    clearError,
    setCurrentUrl,
    setNavigationState,
    addToHistory,
    goBack,
    goForward,
    clearHistory
  }
})