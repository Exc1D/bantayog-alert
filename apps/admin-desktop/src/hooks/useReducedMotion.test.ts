import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReducedMotion } from '../hooks/useReducedMotion'

describe('useReducedMotion', () => {
  beforeEach(() => {
    // Reset matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when user does not prefer reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when user prefers reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('subscribes to media query changes', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener,
        removeEventListener,
        dispatchEvent: vi.fn(),
      })),
    })

    const { unmount } = renderHook(() => useReducedMotion())
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
