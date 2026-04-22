import { computed, watch} from 'vue'
import { useConfigStore } from '@/renderer/store/config.store'
import type { AppConfig, general } from '@/shared/types'
import { ThemeEnum, LocaleEnum } from '@/shared/enums'
import { logger } from '@/renderer/utils/logger.utils'

interface UseConfigOptions {
  /** 是否自动初始化配置 */
  autoInit?: boolean
  /** 初始化失败时的重试次数 */
  retryCount?: number
  /** 重试间隔（毫秒） */
  retryDelay?: number
}

/**
 * 配置相关的组合函数
 */
export function useConfig(options: UseConfigOptions = {}) {
  const { autoInit = false, retryCount = 3, retryDelay = 1000 } = options
  const configStore = useConfigStore()

  // 响应式状态
  const config = computed(() => configStore.getConfig)
  const loading = computed(() => configStore.isLoading)
  const errorCode = computed(() => configStore.errorCode)
  const errorMessage = computed(() => configStore.errorMessage)

  // 通用配置
  const generalConfig = computed(() => config.value?.general ?? null)
  const miniPrograms = computed(() => config.value?.miniPrograms ?? null)
  const defaultMiniProgramId = computed(() => config.value?.defaultMiniProgramId ?? null)
  const workspace = computed(() => config.value?.workspace ?? null)

  // 主题相关
  const theme = computed(() => generalConfig.value?.theme ?? ThemeEnum.LIGHT)

  // 语言相关
  const locale = computed(() => generalConfig.value?.locale ?? LocaleEnum.ZH)
  
  // 自动保存相关
  const autoSave = computed(() => generalConfig.value?.autoSave ?? false)
  const autoSaveInterval = computed(() => generalConfig.value?.autoSaveInterval ?? 30000)

  // 启动相关
  const autoStart = computed(() => generalConfig.value?.autoStart ?? false)
  const messageNotify = computed(() => generalConfig.value?.messageNotify ?? true)

  /**
   * 带重试机制的初始化配置
   */
  async function init(): Promise<boolean> {
    if (configStore.isLoaded) return true
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        await configStore.fetchConfig()
        if (configStore.isLoaded) return true
        
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      } catch (error) {
        logger.warn(`配置初始化第 ${attempt} 次尝试失败`, { error, attempt })
        if (attempt === retryCount) {
          logger.error('配置初始化失败，已达到最大重试次数', { retryCount })
          return false
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
    
    return false
  }

  /**
   * 确保配置已加载
   */
  async function ensureLoaded(): Promise<boolean> {
    if (configStore.isLoaded) return true
    return await init()
  }

  /**
   * 更新通用配置
   */
  async function updateGeneral(general: Partial<general>): Promise<boolean> {
    if (!(await ensureLoaded())) return false
    
    const updatedConfig: Partial<AppConfig> = {
      ...config.value!,
      general: {
        ...config.value!.general,
        ...general
      }
    }
    
    return await configStore.updateConfig(updatedConfig)
  }

  /**
   * 更新主题
   */
  async function updateTheme(newTheme: string): Promise<boolean> {
    return await updateGeneral({ theme: newTheme })
  }

  /**
   * 切换主题
   */
  async function toggleTheme(): Promise<boolean> {
    const newTheme = theme.value === ThemeEnum.DARK ? ThemeEnum.LIGHT : ThemeEnum.DARK
    return await updateTheme(newTheme)
  }

  /**
   * 更新语言
   */
  async function updateLocale(newLocale: string): Promise<boolean> {
    return await updateGeneral({ locale: newLocale })
  }

  /**
   * 更新自动保存设置
   */
  async function updateAutoSave(enabled: boolean, interval?: number): Promise<boolean> {
    const updates: Partial<general> = { autoSave: enabled }
    if (interval !== undefined) {
      updates.autoSaveInterval = interval
    }
    return await updateGeneral(updates)
  }

  /**
   * 获取特定配置项的值
   */
  async function getValue<T = any>(keyPath: string): Promise<T | null> {
    if (!(await ensureLoaded())) return null
    
    try {
      return await configStore.getConfigValue(keyPath)
    } catch (error) {
      logger.error(`获取配置项 ${keyPath} 失败`, { keyPath, error })
      return null
    }
  }

  /**
   * 设置特定配置项的值
   */
  async function setValue<T = any>(keyPath: string, value: T): Promise<boolean> {
    if (!(await ensureLoaded())) return false
    
    try {
      return await configStore.setConfigValue(keyPath, value)
    } catch (error) {
      logger.error(`设置配置项 ${keyPath} 失败`, { keyPath, value, error })
      return false
    }
  }

  /**
   * 更新默认小程序ID
   */
  async function updateDefaultMiniProgramId(newId: string): Promise<boolean> {
    return await setValue('defaultMiniProgramId', newId)
  }

  /**
   * 获取静态文件路径
   */
  async function getStaticPath(): Promise<string> {
    try {
      return await configStore.getStaticPath()
    } catch (error) {
      logger.error('获取静态文件路径失败', { error })
      return ''
    }
  }

  /**
   * 重置配置
   */
  async function reset(): Promise<boolean> {
    try {
      const result = await configStore.resetConfig()
      if (result) {
        // 重置后重新初始化
        await init()
      }
      return result
    } catch (error) {
      logger.error('重置配置失败', { error })
      return false
    }
  }

  /**
   * 清空错误信息
   */
  function clearError(): void {
    configStore.clearError()
  }

  /**
   * 监听配置变化
   */
  function watchConfig<T = any>(
    selector: (config: AppConfig | null) => T,
    callback: (newValue: T, oldValue: T) => void,
    options?: { immediate?: boolean; deep?: boolean }
  ) {
    return watch(
      () => selector(config.value),
      (newValue, oldValue) => {
        if (newValue !== oldValue) {
          callback(newValue as T, oldValue as T)
        }
      },
      { ...options, deep: options?.deep ?? false }
    )
  }

  /**
   * 监听特定配置项变化
   */
  function watchConfigValue<T = any>(
    keyPath: string,
    callback: (newValue: T, oldValue: T) => void,
    options?: { immediate?: boolean }
  ) {
    const getNestedValue = (obj: any, path: string): T | undefined => {
      return path.split('.').reduce((current, key) => current?.[key], obj)
    }
    
    return watch(
      () => getNestedValue(config.value, keyPath),
      (newValue, oldValue) => {
        if (newValue !== oldValue) {
          callback(newValue as T, oldValue as T)
        }
      },
      options
    )
  }

  /**
   * 监听配置加载状态
   */
  function watchLoaded(callback: (loaded: boolean) => void, options?: { immediate?: boolean }) {
    return watch(
      () => configStore.isLoaded,
      (loaded) => callback(loaded),
      options
    )
  }

  /**
   * 检查配置是否包含特定功能
   */
  function hasFeature(featureName: string): boolean {
    if (!config.value) return false
    
    // 检查通用配置中的功能
    if (config.value.general?.[featureName as keyof general] !== undefined) {
      return !!config.value.general[featureName as keyof general]
    }
    
    // 检查其他配置区域
    return false
  }

  /**
   * 获取所有可用的配置键（带缓存）
   */
  function getAvailableKeys(): string[] {
    if (!config.value) return []
    
    const keys: string[] = []
    
    const collectKeys = (obj: any, prefix: string = ''): void => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const fullKey = prefix ? `${prefix}.${key}` : key
          keys.push(fullKey)
          
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            collectKeys(obj[key], fullKey)
          }
        }
      }
    }
    
    collectKeys(config.value)
    return keys
  }

  /**
   * 验证配置的有效性
   */
  function validateConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []
    
    if (!config.value) {
      errors.push('配置为空')
      return { isValid: false, errors, warnings }
    }
    
    // 验证通用配置
    if (!config.value.general) {
      errors.push('通用配置缺失')
    } else {
      if (!config.value.general.theme || !['light', 'dark'].includes(config.value.general.theme)) {
        errors.push('主题配置无效')
      }
      
      if (!config.value.general.locale || typeof config.value.general.locale !== 'string') {
        errors.push('语言配置无效')
      }
      
      // 警告检查
      if (config.value.general.autoSaveInterval && config.value.general.autoSaveInterval < 1000) {
        warnings.push('自动保存间隔过短，可能影响性能')
      }
    }
    
    // 验证工作空间
    if (!config.value.workspace || typeof config.value.workspace !== 'string') {
      errors.push('工作空间配置无效')
    }
    
    // 验证小程序配置
    if (config.value.miniPrograms && !Array.isArray(config.value.miniPrograms)) {
      errors.push('小程序配置格式错误')
    }
    
    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    }
  }

  /**
   * 导出配置为 JSON 字符串
   */
  function exportConfig(): string {
    if (!config.value) return ''
    
    try {
      return JSON.stringify(config.value, null, 2)
    } catch (error) {
      logger.error('导出配置失败', { error })
      return ''
    }
  }

  /**
   * 导入配置
   */
  async function importConfig(configJson: string): Promise<boolean> {
    try {
      const importedConfig = JSON.parse(configJson) as AppConfig
      const validation = validateConfig()
      
      if (!validation.isValid) {
        logger.error('导入的配置验证失败', { errors: validation.errors })
        return false
      }
      
      return await configStore.updateConfig(importedConfig)
    } catch (error) {
      logger.error('导入配置失败', { error })
      return false
    }
  }

  // 自动初始化
  if (autoInit) {
    init().catch(error => {
      logger.warn('自动初始化配置失败', { error })
    })
  }

  return {
    // 状态
    config,
    loading,
    errorCode,
    errorMessage,
    
    // 计算属性
    generalConfig,
    miniPrograms,
    defaultMiniProgramId,
    workspace,
    theme,
    locale,
    autoSave,
    autoSaveInterval,
    autoStart,
    messageNotify,
    
    // 核心方法
    init,
    ensureLoaded,
    updateGeneral,
    updateTheme,
    toggleTheme,
    updateLocale,
    updateAutoSave,
    getValue,
    setValue,
    updateDefaultMiniProgramId,
    getStaticPath,
    reset,
    clearError,
    
    // 监听器
    watchConfig,
    watchConfigValue,
    watchLoaded,
    
    // 工具方法
    hasFeature,
    getAvailableKeys,
    validateConfig,
    exportConfig,
    importConfig
  }
}

/**
 * 配置相关的类型导出
 */
export type UseConfigReturn = ReturnType<typeof useConfig>