import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAlertReadState } from '../useAlertReadState'

describe('useAlertReadState', () => {
  const storageKey = 'bantayog_alert_reads'

  // Mock localStorage with in-memory storage
  let mockStore: Record<string, string> = {}

  beforeEach(() => {
    mockStore = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value
      }),
      clear: vi.fn(() => {
        const keys = Object.keys(mockStore)
        keys.forEach((k) => {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete mockStore[k]
        })
      }),
      removeItem: vi.fn((key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: _omitted, ...rest } = mockStore
        mockStore = rest
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should initialize with empty read state', () => {
    const { result } = renderHook(() => useAlertReadState())
    expect(result.current.readAlerts).toEqual({})
  })

  it('should mark alert as read', () => {
    const { result } = renderHook(() => useAlertReadState())
    act(() => {
      result.current.markAsRead('alert-123')
    })
    expect(result.current.readAlerts['alert-123']).toBe(true)
  })

  it('should persist read state to localStorage', () => {
    const { result } = renderHook(() => useAlertReadState())
    act(() => {
      result.current.markAsRead('alert-123')
    })
    const stored = localStorage.getItem(storageKey)
    expect(stored).toBe(JSON.stringify({ 'alert-123': true }))
  })

  it('should check if alert is unread', () => {
    const { result } = renderHook(() => useAlertReadState())
    expect(result.current.isUnread('alert-123')).toBe(true)
    act(() => {
      result.current.markAsRead('alert-123')
    })
    expect(result.current.isUnread('alert-123')).toBe(false)
  })

  it('should count unread alerts', () => {
    const { result } = renderHook(() => useAlertReadState())
    expect(result.current.unreadCount(['alert-1', 'alert-2'])).toBe(2)
    act(() => {
      result.current.markAsRead('alert-1')
    })
    expect(result.current.unreadCount(['alert-1', 'alert-2'])).toBe(1)
  })
})
