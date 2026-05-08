import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFocusMode } from '../hooks/useFocusMode'

describe('useFocusMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with no focused zone', () => {
    const { result } = renderHook(() => useFocusMode())
    expect(result.current.focusedZone).toBeNull()
    expect(result.current.isFocusModeActive).toBe(false)
  })

  it('enters focus mode for map zone', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      result.current.enterFocusMode('map')
    })

    expect(result.current.focusedZone).toBe('map')
    expect(result.current.isFocusModeActive).toBe(true)
  })

  it('enters focus mode for grid zone', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      result.current.enterFocusMode('grid')
    })

    expect(result.current.focusedZone).toBe('grid')
    expect(result.current.isFocusModeActive).toBe(true)
  })

  it('exits focus mode', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      result.current.enterFocusMode('map')
    })

    act(() => {
      result.current.exitFocusMode()
    })

    expect(result.current.focusedZone).toBeNull()
    expect(result.current.isFocusModeActive).toBe(false)
  })

  it('responds to Alt+1 keyboard shortcut to focus map', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true }))
    })

    expect(result.current.focusedZone).toBe('map')
    expect(result.current.isFocusModeActive).toBe(true)
  })

  it('responds to Alt+2 keyboard shortcut to focus grid', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true }))
    })

    expect(result.current.focusedZone).toBe('grid')
    expect(result.current.isFocusModeActive).toBe(true)
  })

  it('responds to Escape key to exit focus mode', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      result.current.enterFocusMode('map')
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(result.current.focusedZone).toBeNull()
    expect(result.current.isFocusModeActive).toBe(false)
  })

  it('does not respond to unmodified number keys', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    })

    expect(result.current.focusedZone).toBeNull()
    expect(result.current.isFocusModeActive).toBe(false)
  })

  it('does not respond to Alt+3 (no zone assigned)', () => {
    const { result } = renderHook(() => useFocusMode())

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', altKey: true }))
    })

    expect(result.current.focusedZone).toBeNull()
    expect(result.current.isFocusModeActive).toBe(false)
  })
})
