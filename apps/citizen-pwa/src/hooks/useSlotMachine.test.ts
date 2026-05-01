import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSlotMachine } from './useSlotMachine.js'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useSlotMachine', () => {
  it('starts with empty display before startDelayMs', () => {
    const rafCbs: FrameRequestCallback[] = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCbs.push(cb)
      return rafCbs.length
    })

    const { result } = renderHook(() => useSlotMachine('ABC123', 600, 400))
    expect(result.current.display).toBe('')
    expect(result.current.done).toBe(false)
  })

  it('sets display to target and done=true after full duration', () => {
    let frame = 0
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      // simulate time past start + duration
      cb(10000)
      return ++frame
    })

    const { result } = renderHook(() => useSlotMachine('REF-001', 600, 0))
    expect(result.current.display).toBe('REF-001')
    expect(result.current.done).toBe(true)
  })

  it('cleans up requestAnimationFrame on unmount', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(99)

    const { unmount } = renderHook(() => useSlotMachine('X', 100, 0))
    unmount()
    expect(cancelSpy).toHaveBeenCalledWith(99)
  })
})
