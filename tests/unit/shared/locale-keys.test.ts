import { describe, it, expect } from 'vitest'
import zhCN from '@/shared/i18n/locales/zhCN'
import enUS from '@/shared/i18n/locales/enUS'

function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectLeafPaths(value as Record<string, unknown>, fullPath))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

describe('i18n key consistency', () => {
  const zhKeys = new Set(collectLeafPaths(zhCN))
  const enKeys = new Set(collectLeafPaths(enUS))

  it('should have the same number of keys in both locales', () => {
    expect(zhKeys.size).toBe(enKeys.size)
  })

  it('should have identical key sets between zhCN and enUS', () => {
    const onlyZh = [...zhKeys].filter(k => !enKeys.has(k))
    const onlyEn = [...enKeys].filter(k => !zhKeys.has(k))

    const msg = [
      onlyZh.length ? `Keys only in zhCN: ${onlyZh.join(', ')}` : '',
      onlyEn.length ? `Keys only in enUS: ${onlyEn.join(', ')}` : '',
    ].filter(Boolean).join('; ')

    expect(onlyZh).toEqual([] as string[], msg)
    expect(onlyEn).toEqual([] as string[], msg)
  })
})

