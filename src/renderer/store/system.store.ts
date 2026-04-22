import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SystemInfo, ApiResponse } from '@/shared/types'
import { ErrorCode } from '@/shared/enums'
import { handleApiError } from '@/renderer/utils/error.utils'

export const useSystemStore = defineStore('system', () => {
  // 状态
  const systemInfo = ref<SystemInfo | null>(null)
  const loading = ref(false)
  const errorCode = ref<ErrorCode | null>(null)
  const errorMessage = ref<string | null>(null)

  // 计算属性
  const getSystemInfo = computed(() => systemInfo.value)
  const isLoaded = computed(() => systemInfo.value !== null)
  const isLoading = computed(() => loading.value)
  const getError = computed(() => errorMessage.value)

  // 方法
  
  /**
   * 从主进程获取系统信息
   */
  const fetchSystemInfo = async (): Promise<void> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null

    try {
      const response = await window.electronAPI.system.getSystemInfo() as ApiResponse<SystemInfo>
      
      if (response.success && response.data) {
        systemInfo.value = response.data as SystemInfo
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
      }
    } catch (error) {
      errorCode.value = ErrorCode.SYSTEM_INFO_ERROR
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
    } finally {
      loading.value = false
    }
  }

  /**
   * 清空错误信息
   */
  const clearError = (): void => {
    errorCode.value = null
    errorMessage.value = null
  }

  /**
   * 清空系统信息状态
   */
  const clearSystemInfo = (): void => {
    systemInfo.value = null
    errorCode.value = null
    errorMessage.value = null
    loading.value = false
  }

  return {
    // 状态
    systemInfo,
    loading,
    errorCode,
    errorMessage,
    
    // 计算属性
    getSystemInfo,
    isLoaded,
    isLoading,
    getError,
    
    // 方法
    fetchSystemInfo,
    clearError,
    clearSystemInfo
  }
})