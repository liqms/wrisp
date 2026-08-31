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

  it('should apply graphite theme color when config sets themeColor to graphite', async () => {
    // 模拟用户在设置中选择石墨灰后的配置状态
    const { THEME_COLOR } = await import('@/shared/enums/config.enums')
    const graphiteOverrides = (await import('@/shared/enums/themeColor.enums'))
      .THEME_OVERRIDES.light[THEME_COLOR.GRAPHITE]

    vi.mocked(window.electronAPI.config.get).mockResolvedValue({
      success: true,
      data: {
        general: {
          themeMode: 'light',
          themeColor: 'graphite',
          locale: 'zh-CN',
        },
        workspace: '/mock/workspace',
        currentProjectId: '',
        version: '1.0.0',
      },
      code: 0,
      timestamp: Date.now(),
    } as never)

    const store = useConfigStore()
    await store.fetchConfig()

    const theme = useTheme()
    expect(theme.themeColor.value).toBe('graphite')
    expect(theme.naiveThemeOverrides.value.common.primaryColor).toBe(
      graphiteOverrides.primaryColor,
    )
  })
})

