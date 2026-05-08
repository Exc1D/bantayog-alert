import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConnectionStatus } from './useConnectionStatus'

describe('useConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns live status when navigator.onLine is true', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: true },
      writable: true,
    })

    const { result } = renderHook(() => useConnectionStatus())
    expect(result.current.status).toBe('live')
  })

  it('returns offline status when navigator.onLine is false', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true,
    })

    const { result } = renderHook(() => useConnectionStatus())
    expect(result.current.status).toBe('offline')
  })

  it('transitions to live when online event fires', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true,
    })

    const { result } = renderHook(() => useConnectionStatus())
    expect(result.current.status).toBe('offline')

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.status).toBe('live')
  })

  it('transitions to offline when offline event fires', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: true },
      writable: true,
    })

    const { result } = renderHook(() => useConnectionStatus())
    expect(result.current.status).toBe('live')

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.status).toBe('offline')
  })

  it('transitions to stale after 30 seconds without update', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: true },
      writable: true,
    })

    const { result } = renderHook(() => useConnectionStatus())
    expect(result.current.status).toBe('live')

    act(() => {
      vi.advanceTimersByTime(35_000)
    })

    expect(result.current.status).toBe('stale')
  })

  it('does not transition to stale when status is offline', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true,
    })

    const { result } = renderHook(() => useConnectionStatus())
    expect(result.current.status).toBe('offline')

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.status).toBe('offline')
  })

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useConnectionStatus())
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
