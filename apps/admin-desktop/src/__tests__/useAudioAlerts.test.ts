import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioAlerts } from '../hooks/useAudioAlerts'

describe('useAudioAlerts', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {
        state = 'running'
        resume = vi.fn().mockResolvedValue(undefined)
        close = vi.fn().mockResolvedValue(undefined)
        createOscillator = vi.fn().mockReturnValue({
          type: '',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        })
        createGainNode = vi.fn().mockReturnValue({
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        })
        destination = {}
      },
    )
  })

  it('initializes disabled', () => {
    const { result } = renderHook(() => useAudioAlerts())
    expect(result.current.enabled).toBe(false)
  })

  it('toggles enabled state', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })
    expect(result.current.enabled).toBe(true)
  })
})
