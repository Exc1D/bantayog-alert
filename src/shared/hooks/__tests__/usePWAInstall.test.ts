/**
 * usePWAInstall Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePWAInstall } from '../usePWAInstall'

// matchMedia and localStorage are now mocked in setup.ts - no per-file overrides needed

describe('usePWAInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
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
