/**
 * usePWAInstall Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePWAInstall } from '../usePWAInstall'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage with persistent store
const localStorageStore: Record<string, string> = {}
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => localStorageStore[key] || null),
    setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value }),
    removeItem: vi.fn((key: string) => { delete localStorageStore[key] }),
  },
  writable: true,
})

describe('usePWAInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(localStorageStore).forEach(key => delete localStorageStore[key])
  })

  it('returns deferredPrompt as null initially', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.deferredPrompt).toBeNull()
  })

  it('returns isInstalled as boolean', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(typeof result.current.isInstalled).toBe('boolean')
  })

  it('returns isStandalone as boolean', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(typeof result.current.isStandalone).toBe('boolean')
  })

  it('returns installApp as function', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(typeof result.current.installApp).toBe('function')
  })

  it('installApp returns false when no deferred prompt', async () => {
    const { result } = renderHook(() => usePWAInstall())
    const outcome = await result.current.installApp()
    expect(outcome).toBe(false)
  })

  it('returns dismissBanner as function', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(typeof result.current.dismissBanner).toBe('function')
  })

  it('dismissBanner sets localStorage and clears deferredPrompt', () => {
    const { result } = renderHook(() => usePWAInstall())

    act(() => {
      result.current.dismissBanner()
    })

    expect(localStorage.setItem).toHaveBeenCalledWith('pwa_install_dismissed', 'true')
  })

  it('dismissBanner can be called without crashing when deferredPrompt is null', () => {
    const { result } = renderHook(() => usePWAInstall())

    expect(() => result.current.dismissBanner()).not.toThrow()
  })

  it('returns installError as null initially', () => {
    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.installError).toBeNull()
  })

  it('installApp sets installError when deferredPrompt is null', async () => {
    const { result } = renderHook(() => usePWAInstall())

    await act(async () => {
      await result.current.installApp()
    })

    expect(result.current.installError).toBe('Installation is not available right now.')
  })

  it('dismissBanner clears installError', async () => {
    const { result } = renderHook(() => usePWAInstall())

    await act(async () => {
      await result.current.installApp()
    })
    expect(result.current.installError).not.toBeNull()

    act(() => {
      result.current.dismissBanner()
    })

    expect(result.current.installError).toBeNull()
  })
})
