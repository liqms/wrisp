import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from '@/renderer/store/notification.store'
import type { NotificationMessage } from '@/shared/types'

function createMessage(overrides: Partial<NotificationMessage> = {}): NotificationMessage {
  return {
    id: 'test-1',
    title: 'Test',
    content: 'Test content',
    level: 'info',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should start with empty notifications', () => {
    const store = useNotificationStore()
    expect(store.notifications).toEqual([])
  })

  it('should add a notification', () => {
    const store = useNotificationStore()
    const msg = createMessage()
    store.addNotification(msg)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toEqual(msg)
  })

  it('should remove a notification by id', () => {
    const store = useNotificationStore()
    store.addNotification(createMessage({ id: 'a' }))
    store.addNotification(createMessage({ id: 'b' }))
    expect(store.notifications).toHaveLength(2)
    store.removeNotification('a')
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0].id).toBe('b')
  })

  it('should clear all notifications', () => {
    const store = useNotificationStore()
    store.addNotification(createMessage({ id: 'a' }))
    store.addNotification(createMessage({ id: 'b' }))
    store.clearAll()
    expect(store.notifications).toEqual([])
  })

  it('should auto-remove notification after timeout', async () => {
    vi.useFakeTimers()
    const store = useNotificationStore()
    store.addNotification(createMessage({ id: 'auto', timeout: 100 }))
    expect(store.notifications).toHaveLength(1)
    vi.advanceTimersByTime(150)
    expect(store.notifications).toHaveLength(0)
    vi.useRealTimers()
  })

  it('should not auto-remove if timeout is 0', () => {
    vi.useFakeTimers()
    const store = useNotificationStore()
    store.addNotification(createMessage({ id: 'persist', timeout: 0 }))
    expect(store.notifications).toHaveLength(1)
    vi.advanceTimersByTime(10000)
    expect(store.notifications).toHaveLength(1)
    vi.useRealTimers()
  })

  it('should handle remove of non-existent notification gracefully', () => {
    const store = useNotificationStore()
    expect(() => store.removeNotification('nonexistent')).not.toThrow()
  })
})

