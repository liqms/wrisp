import { computed } from 'vue'
import { useSystemStore } from '@/renderer/store/system.store'
import type { SystemInfo } from '@/shared/types'
import { logger } from '@/renderer/utils/logger.utils'

interface UseSystemOptions {
  /** 是否自动初始化系统信息 */
  autoInit?: boolean
  /** 初始化失败时的重试次数 */
  retryCount?: number
  /** 重试间隔（毫秒） */
  retryDelay?: number
}

/**
 * 系统信息相关的组合函数
 */
export function useSystem(options: UseSystemOptions = {}) {
  const { autoInit = true, retryCount = 3, retryDelay = 1000 } = options
  const systemStore = useSystemStore()

  // 响应式状态
  const systemInfo = computed(() => systemStore.getSystemInfo)
  const loading = computed(() => systemStore.isLoading)
  const errorCode = computed(() => systemStore.errorCode)
  const errorMessage = computed(() => systemStore.errorMessage)

  // 系统信息的便捷访问属性
  const platform = computed(() => systemInfo.value?.platform ?? '')
  const arch = computed(() => systemInfo.value?.arch ?? '')
  const nodeVersion = computed(() => systemInfo.value?.nodeVersion ?? '')
  const electronVersion = computed(() => systemInfo.value?.electronVersion ?? '')
  const appVersion = computed(() => systemInfo.value?.appVersion ?? '')
  const hostname = computed(() => systemInfo.value?.hostname ?? '')
  const totalMemory = computed(() => systemInfo.value?.totalMemory ?? 0)
  const freeMemory = computed(() => systemInfo.value?.freeMemory ?? 0)
  const cpus = computed(() => systemInfo.value?.cpus ?? 0)
  const viewSize = computed(() => systemInfo.value?.viewSize ?? [0, 0])

  /**
   * 计算可用内存百分比
   */
  const memoryUsagePercent = computed(() => {
    if (!systemInfo.value || systemInfo.value.totalMemory === 0) return 0
    return ((systemInfo.value.totalMemory - systemInfo.value.freeMemory) / systemInfo.value.totalMemory) * 100
  })

  /**
   * 格式化内存大小（字节转可读格式）
   */
  function formatMemory(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 带重试机制的初始化系统信息
   */
  async function init(): Promise<boolean> {
    if (systemStore.isLoaded) return true
    
    try {
      for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
          await systemStore.fetchSystemInfo()
          if (systemStore.isLoaded) return true
          
          if (attempt < retryCount) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        } catch (error) {
          logger.warn(`系统信息初始化第 ${attempt} 次尝试失败`, { error, attempt })
          if (attempt === retryCount) {
            logger.error('系统信息初始化失败，已达到最大重试次数', { retryCount })
            return false
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
      
      return false
    } catch (error) {
      logger.error('系统信息初始化发生未预期错误', { error })
      return false
    }
  }

  /**
   * 确保系统信息已加载
   */
  async function ensureLoaded(): Promise<boolean> {
    if (systemStore.isLoaded) return true
    return await init()
  }

  /**
   * 重新加载系统信息
   */
  async function reload(): Promise<boolean> {
    try {
      await systemStore.fetchSystemInfo()
      return systemStore.isLoaded
    } catch (error) {
      logger.error('重新加载系统信息失败', { error })
      return false
    }
  }

  /**
   * 清空错误信息
   */
  function clearError(): void {
    systemStore.clearError()
  }

  /**
   * 清空系统信息状态
   */
  function clear(): void {
    systemStore.clearSystemInfo()
  }

  /**
   * 获取系统信息快照
   */
  function getSnapshot(): SystemInfo | null {
    if (!systemInfo.value) return null
    return { ...systemInfo.value }
  }

  /**
   * 检查系统是否为 macOS
   */
  function isMacOS(): boolean {
    return platform.value === 'darwin'
  }

  /**
   * 检查系统是否为 Windows
   */
  function isWindows(): boolean {
    return platform.value === 'win32'
  }

  /**
   * 检查系统是否为 Linux
   */
  function isLinux(): boolean {
    return platform.value === 'linux'
  }

  // 自动初始化
  if (autoInit) {
    init().catch(error => {
      logger.warn('自动初始化系统信息失败', { error })
    })
  }

  return {
    // 状态
    systemInfo,
    loading,
    errorCode,
    errorMessage,
    
    // 系统信息便捷访问属性
    platform,
    arch,
    nodeVersion,
    electronVersion,
    appVersion,
    hostname,
    totalMemory,
    freeMemory,
    cpus,
    viewSize,
    memoryUsagePercent,
    
    // 核心方法
    init,
    ensureLoaded,
    reload,
    clearError,
    clear,
    getSnapshot,
    
    // 工具方法
    formatMemory,
    isMacOS,
    isWindows,
    isLinux
  }
}

/**
 * 系统信息相关的类型导出
 */
export type UseSystemReturn = ReturnType<typeof useSystem>
