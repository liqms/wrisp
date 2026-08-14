// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mocks (hoisted by vitest) ──
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp'), getVersion: vi.fn(() => '1.0.0'), getName: vi.fn(() => 'Wrisp'), on: vi.fn() },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}))
vi.mock('@/main/utils/logger', () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))
vi.mock('winston', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  format: { combine: vi.fn(), timestamp: vi.fn(), printf: vi.fn(), colorize: vi.fn(), simple: vi.fn(), json: vi.fn() },
  transports: { Console: vi.fn(), File: vi.fn() },
  addColors: vi.fn(),
}))
vi.mock('winston-daily-rotate-file', () => ({ default: vi.fn() }))

// ── Mock configService using vi.hoisted ──
const mockConfig = vi.hoisted(() => ({
  version: '1.0.0',
  workspace: '/mock/workspace/Wrisp',
  general: { themeMode: 'system', themeColor: 'green', locale: 'zh-CN' },
}))

const mockConfigService = vi.hoisted(() => ({
  getConfig: vi.fn().mockReturnValue(mockConfig),
  getValue: vi.fn().mockImplementation((keyPath: string) => {
    const keys = keyPath.split('.')
    let val: unknown = mockConfig
    for (const key of keys) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[key]
      else return undefined
    }
    return val
  }),
  setValue: vi.fn(),
  resetConfig: vi.fn(),
  setWorkspace: vi.fn(),
}))

vi.mock('@/main/core/services/config.service', () => ({
  configService: mockConfigService,
  default: vi.fn(() => mockConfigService),
}))

import { getConfig, getValue, setValue, resetConfig, setWorkspace } from '@/main/core/apis/config.api'
import { ErrorCode } from '@/shared/enums'

describe('Config API', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('getConfig', () => {
    it('should return config wrapped in success response', async () => {
      const result = await getConfig()
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockConfig)
      expect(result.code).toBe(ErrorCode.SUCCESS)
      expect(mockConfigService.getConfig).toHaveBeenCalledOnce()
    })

    it('should return error response when service throws', async () => {
      mockConfigService.getConfig.mockImplementationOnce(() => { throw new Error('DB error') })
      const result = await getConfig()
      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCode.CONFIG_GET_FAILED)
    })
  })

  describe('getValue', () => {
    it('should return value for valid key path', async () => {
      const result = await getValue('general.themeMode')
      expect(result.success).toBe(true)
      expect(result.data).toBe('system')
    })

    it('should return error for invalid key path', async () => {
      mockConfigService.getValue.mockReturnValueOnce(undefined)
      const result = await getValue('nonexistent.key')
      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCode.CONFIG_KEY_PATH_INVALID)
    })

    it('should return error when service throws', async () => {
      mockConfigService.getValue.mockImplementationOnce(() => { throw new Error('error') })
      const result = await getValue('general.themeMode')
      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCode.CONFIG_GET_FAILED)
    })
  })

  describe('setValue', () => {
    it('should return empty success on valid set', async () => {
      const result = await setValue('general.themeMode', 'dark')
      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
      expect(mockConfigService.setValue).toHaveBeenCalledWith('general.themeMode', 'dark')
    })

    it('should return error when service throws', async () => {
      mockConfigService.setValue.mockImplementationOnce(() => { throw new Error('save failed') })
      const result = await setValue('general.themeMode', 'dark')
      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCode.CONFIG_UPDATE_FAILED)
    })
  })

  describe('resetConfig', () => {
    it('should return empty success', async () => {
      const result = await resetConfig()
      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
      expect(mockConfigService.resetConfig).toHaveBeenCalledOnce()
    })

    it('should return error when service throws', async () => {
      mockConfigService.resetConfig.mockImplementationOnce(() => { throw new Error('reset failed') })
      const result = await resetConfig()
      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCode.CONFIG_RESET_FAILED)
    })
  })

  describe('setWorkspace', () => {
    it('should return empty success', async () => {
      const result = await setWorkspace('/new/workspace')
      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
      expect(mockConfigService.setWorkspace).toHaveBeenCalledWith('/new/workspace')
    })

    it('should return error when service throws', async () => {
      mockConfigService.setWorkspace.mockImplementationOnce(() => { throw new Error('bad path') })
      const result = await setWorkspace('/bad/path')
      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCode.CONFIG_UPDATE_FAILED)
    })
  })
})

