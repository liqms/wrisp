import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConfigStore } from '@/renderer/store/config.store'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useConfigStore', () => {
  it('should start with null config', () => {
    const store = useConfigStore()
    expect(store.config).toBeNull()
    expect(store.isLoaded).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('should fetch config from electronAPI', async () => {
    const store = useConfigStore()
    await store.fetchConfig()

    expect(store.isLoaded).toBe(true)
    expect(store.config).not.toBeNull()
    expect(store.config?.general).toBeDefined()
    expect(store.config?.general?.themeMode).toBe('system')
    expect(store.loading).toBe(false)
  })

  it('should get a specific config value', async () => {
    const store = useConfigStore()
    await store.fetchConfig()

    const locale = await store.getConfigValue('general.locale')
    expect(locale).toBe('zh-CN')
  })

  it('should set a config value', async () => {
    const store = useConfigStore()
    await store.fetchConfig()

    const result = await store.setConfigValue('general.themeMode', 'dark')
    expect(result).toBe(true)
    expect(store.config?.general?.themeMode).toBe('dark')
  })

  it('should reset config', async () => {
    const store = useConfigStore()
    await store.fetchConfig()
    expect(store.isLoaded).toBe(true)

    const result = await store.resetConfig()
    expect(result).toBe(true)
    expect(store.config).toBeNull()
    expect(store.isLoaded).toBe(false)
  })

  it('should clear error state', () => {
    const store = useConfigStore()
    store.clearError()
    expect(store.errorCode).toBeNull()
    expect(store.errorMessage).toBeNull()
  })

  it('should clear config state', () => {
    const store = useConfigStore()
    store.clearConfig()
    expect(store.config).toBeNull()
    expect(store.loading).toBe(false)
  })
})

