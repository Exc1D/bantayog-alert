import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('useOnlineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when navigator.onLine is true', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    })

    it('returns isOnline: true and navigatorOnline: true when probe succeeds', async () => {
      mockFetch.mockResolvedValueOnce(new Response('ok'))
      const { result } = renderHook(() => useOnlineStatus())

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(result.current.navigatorOnline).toBe(true)
        expect(result.current.isOnline).toBe(true)
      })
    })

    it('returns isOnline: false when probe fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network fail'))
      const { result } = renderHook(() => useOnlineStatus())

      await vi.waitFor(() => {
        expect(result.current.isOnline).toBe(false)
      })
    })
  })

  describe('when navigator.onLine is false', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    })

    it('skips probe and returns isOnline: false immediately', () => {
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current.navigatorOnline).toBe(false)
      expect(result.current.isOnline).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('online/offline event listeners', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    })

    it('updates navigatorOnline when offline event fires', () => {
      mockFetch.mockResolvedValue(new Response('ok'))
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current.navigatorOnline).toBe(true)

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current.navigatorOnline).toBe(false)
    })

    it('updates navigatorOnline when online event fires', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current.navigatorOnline).toBe(false)

      act(() => {
        window.dispatchEvent(new Event('online'))
      })

      expect(result.current.navigatorOnline).toBe(true)
    })
  })
})
