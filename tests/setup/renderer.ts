import { vi } from 'vitest'
import type { ApiResponse } from '@/shared/types'

// Guard: only define window.electronAPI in DOM-like environments (happy-dom/jsdom)
if (typeof window !== 'undefined') {
  const mockConfigStore: Record<string, unknown> = {
    general: {
      themeMode: 'system',
      themeColor: 'green',
      locale: 'zh-CN',
    },
    workspace: '/mock/workspace',
    currentProjectId: '',
    version: '1.0.0',
  }

  function createApiResponse<T>(data: T): ApiResponse<T> {
    return { success: true, data, code: undefined, message: undefined }
  }

  window.electronAPI = {
    on: vi.fn(),
    config: {
      get: vi.fn().mockResolvedValue(createApiResponse(mockConfigStore)),
      getValue: vi.fn().mockImplementation((keyPath: string) => {
        const keys = keyPath.split('.')
        let val: unknown = mockConfigStore
        for (const key of keys) {
          if (val && typeof val === 'object') val = (val as Record<string, unknown>)[key]
          else return Promise.resolve(createApiResponse(undefined))
        }
        return Promise.resolve(createApiResponse(val))
      }),
      setValue: vi.fn().mockResolvedValue(createApiResponse(true)),
      setWorkspace: vi.fn().mockResolvedValue(createApiResponse(true)),
      reset: vi.fn().mockResolvedValue(createApiResponse(true)),
    },
    system: {
      showSystemNotification: vi.fn(),
      getSystemInfo: vi.fn().mockResolvedValue(createApiResponse({
        platform: 'win32',
        arch: 'x64',
        version: '10.0.0',
        locale: 'zh-CN',
      })),
    },
    webview: {
      create: vi.fn(),
      destroy: vi.fn(),
      navigate: vi.fn(),
      getState: vi.fn(),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
    },
    capture: {
      startCapture: vi.fn(),
      stopCapture: vi.fn(),
    },
    project: {
      list: vi.fn().mockResolvedValue(createApiResponse([])),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    skill: {
      list: vi.fn().mockResolvedValue(createApiResponse([])),
      execute: vi.fn(),
    },
    window: {
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
    },
    ai: {
      chat: vi.fn(),
      streamChat: vi.fn(),
    },
  }
}
