/**
 * usePWAInstall Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
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

describe('usePWAInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
