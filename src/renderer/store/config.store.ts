import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig, ApiResponse } from '@/shared/types'
import { ErrorCode } from '@/shared/enums'
import { setLocale } from '@/renderer/plugins/i18n'
import { handleApiError } from '@/renderer/utils/error.utils'

export const useConfigStore = defineStore('config', () => {
  // 状态
  const config = ref<AppConfig | null>(null)
  const loading = ref(false)
  const errorCode = ref<ErrorCode | null>(null)
  const errorMessage = ref<string | null>(null)

  // 计算属性
  const getConfig = computed(() => config.value)
  const isLoaded = computed(() => config.value !== null)
  const isLoading = computed(() => loading.value)
  const getError = computed(() => errorMessage.value)

  // 方法
  
  /**
   * 从主进程获取配置
   */
  const fetchConfig = async (): Promise<void> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null

    try {
      const response = await window.electronAPI.config.get() as ApiResponse<AppConfig>
      
      if (response.success && response.data) {
        config.value = response.data as AppConfig
        
        // 配置获取成功后，根据配置更新语言
        await setLocale(config.value.general.locale)
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
      }
    } catch (error) {
      errorCode.value = ErrorCode.CONFIG_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新配置
   */
  const updateConfig = async (newConfig: Partial<AppConfig>): Promise<boolean> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null

    try {
      const response = await window.electronAPI.config.set(newConfig) as ApiResponse<void>
      
      if (response.success) {
        // 更新本地配置状态
        if (config.value) {
          config.value = { ...config.value, ...newConfig }
        }
        return true
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return false
      }
    } catch (error) {
      errorCode.value = ErrorCode.CONFIG_UPDATE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取特定配置项的值
   */
  const getConfigValue = async (keyPath: string): Promise<any> => {
    try {
      const response = await window.electronAPI.config.getValue(keyPath) as ApiResponse<any>
      
      if (response.success) {
        return response.data
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return null
      }
    } catch (error) {
      errorCode.value = ErrorCode.CONFIG_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return null
    }
  }

  /**
   * 设置特定配置项的值
   */
  const setConfigValue = async (keyPath: string, value: any): Promise<boolean> => {
    try {
      const response = await window.electronAPI.config.setValue(keyPath, value) as ApiResponse<void>
      
      if (response.success) {
        // 更新本地配置状态
        if (config.value) {
          // 使用深拷贝更新嵌套属性
          const updateNestedValue = (obj: any, path: string, val: any): any => {
            const keys = path.split('.')
            const currentKey = keys[0]
            
            if (keys.length === 1) {
              return { ...obj, [currentKey]: val }
            } else {
              return {
                ...obj,
                [currentKey]: updateNestedValue(obj[currentKey] || {}, keys.slice(1).join('.'), val)
              }
            }
          }
          
          config.value = updateNestedValue(config.value, keyPath, value)
        }
        return true
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return false
      }
    } catch (error) {
      errorCode.value = ErrorCode.CONFIG_UPDATE_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return false
    }
  }

  /**
   * 获取静态文件路径
   */
  const getStaticPath = async (): Promise<string> => {
    try {
      const response = await window.electronAPI.config.getStaticPath() as ApiResponse<string>
      
      if (response.success && response.data) {
        return response.data as string
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return ''
      }
    } catch (error) {
      errorCode.value = ErrorCode.CONFIG_GET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return ''
    }
  }

  /**
   * 重置配置为默认值
   */
  const resetConfig = async (): Promise<boolean> => {
    loading.value = true
    errorCode.value = null
    errorMessage.value = null

    try {
      const response = await window.electronAPI.config.reset() as ApiResponse<void>
      
      if (response.success) {
        // 清空本地配置状态，下次访问时会重新获取
        config.value = null
        return true
      } else {
        errorCode.value = response.code
        errorMessage.value = handleApiError(response)
        return false
      }
    } catch (error) {
      errorCode.value = ErrorCode.CONFIG_RESET_FAILED
      errorMessage.value = handleApiError({ success: false, code: errorCode.value })
      return false
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
   * 清空配置状态
   */
  const clearConfig = (): void => {
    config.value = null
    errorCode.value = null
    errorMessage.value = null
    loading.value = false
  }

  return {
    // 状态
    config,
    loading,
    errorCode,
    errorMessage,
    
    // 计算属性
    getConfig,
    isLoaded,
    isLoading,
    getError,
    
    // 方法
    fetchConfig,
    updateConfig,
    getConfigValue,
    setConfigValue,
    getStaticPath,
    resetConfig,
    clearError,
    clearConfig
  }
})