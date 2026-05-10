import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioAlerts } from '../hooks/useAudioAlerts'

function createLocalStorageStub() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  }
}

interface MockAudioCtx {
  createOscillator: ReturnType<typeof vi.fn>
  createGain: ReturnType<typeof vi.fn>
}

describe('useAudioAlerts', () => {
  let capturedContexts: MockAudioCtx[] = []

  beforeEach(() => {
    capturedContexts = []
    vi.stubGlobal('localStorage', createLocalStorageStub())
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {
        state = 'running'
        currentTime = 0
        destination = {}
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
        createGain = vi.fn().mockReturnValue({
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        })

        constructor() {
          capturedContexts.push({
            createOscillator: this.createOscillator,
            createGain: this.createGain,
          })
        }
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

  it('persists enabled state to localStorage', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })
    expect(localStorage.getItem('bantayog.audio-alerts-enabled')).toBe('true')
  })

  it('reads persisted state on mount', () => {
    localStorage.setItem('bantayog.audio-alerts-enabled', 'true')
    const { result } = renderHook(() => useAudioAlerts())
    expect(result.current.enabled).toBe(true)
  })

  it('play() is a no-op when disabled', () => {
    const { result } = renderHook(() => useAudioAlerts())
    expect(() => {
      result.current.play()
    }).not.toThrow()
    expect(capturedContexts).toHaveLength(0)
  })

  it('play() exercises Web Audio API when enabled', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })
    expect(capturedContexts).toHaveLength(1)

    expect(() => {
      result.current.play()
    }).not.toThrow()

    const ctx = capturedContexts[0]!
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1)
    expect(ctx.createGain).toHaveBeenCalledTimes(1)
  })
})
