import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTheme } from '@/renderer/composables/useTheme'
import { useConfigStore } from '@/renderer/store/config.store'

beforeEach(() => {
  setActivePinia(createPinia())

  // Default: system prefers light
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe('useTheme', () => {
  it('should return theme state after config loads', async () => {
    const store = useConfigStore()
    await store.fetchConfig()

    const theme = useTheme()
    expect(theme.activeMode).toBeDefined()
    expect(theme.themeColor).toBeDefined()
    expect(theme.currentThemeColors).toBeDefined()
    expect(theme.naiveThemeOverrides).toBeDefined()
  })

  it('should return light mode when system prefers light', async () => {
    const store = useConfigStore()
    await store.fetchConfig()

    const theme = useTheme()
    expect(theme.activeMode.value).toBe('light')
  })

  it('should return dark mode when system prefers dark', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const store = useConfigStore()
    await store.fetchConfig()

    const theme = useTheme()
    expect(theme.activeMode.value).toBe('dark')
  })

  it('should return naiveThemeOverrides with primaryColor', async () => {
    const store = useConfigStore()
    await store.fetchConfig()

    const theme = useTheme()
    expect(theme.naiveThemeOverrides.value.common.primaryColor).toBeDefined()
    expect(typeof theme.naiveThemeOverrides.value.common.primaryColor).toBe('string')
  })
})

