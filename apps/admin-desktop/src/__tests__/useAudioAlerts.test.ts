import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudioAlerts } from '../hooks/useAudioAlerts'

describe('useAudioAlerts', () => {
  let mockOscillator: ReturnType<typeof createMockOscillator>
  let mockGainNode: ReturnType<typeof createMockGainNode>
  let store: Record<string, string>

  function createMockOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    }
  }

  function createMockGainNode() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }
  }

  beforeEach(() => {
    store = {}
    mockOscillator = createMockOscillator()
    mockGainNode = createMockGainNode()

    const mockInstances: ReturnType<typeof createMockAudioContext>[] = []

    function createMockAudioContext() {
      return {
        state: 'running',
        currentTime: 0,
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        createOscillator: vi.fn().mockReturnValue(mockOscillator),
        createGain: vi.fn().mockReturnValue(mockGainNode),
        destination: {},
      }
    }

    const MockAudioContextClass = vi.fn().mockImplementation(function () {
      const instance = createMockAudioContext()
      mockInstances.push(instance)
      return instance
    }) as unknown as typeof AudioContext

    vi.stubGlobal('AudioContext', MockAudioContextClass)

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        store[key] = undefined as unknown as string
      }),
      clear: vi.fn(() => {
        store = {}
      }),
    })
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

  it('persists toggle to localStorage', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })
    expect(localStorage.setItem).toHaveBeenCalledWith('bantayog.audio-alerts-enabled', 'true')

    act(() => {
      result.current.toggle()
    })
    expect(localStorage.setItem).toHaveBeenCalledWith('bantayog.audio-alerts-enabled', 'false')
  })

  it('does not play when disabled', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.play()
    })
    expect(AudioContext).not.toHaveBeenCalled()
  })

  it('does not play when document is hidden', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })

    act(() => {
      result.current.play()
    })
    expect(AudioContext).not.toHaveBeenCalled()
  })

  it('creates AudioContext lazily on first play', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })

    act(() => {
      result.current.play()
    })

    expect(AudioContext).toHaveBeenCalledTimes(1)
  })

  it('reuses existing AudioContext on subsequent plays', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })

    act(() => {
      result.current.play()
    })
    act(() => {
      result.current.play()
    })

    expect(AudioContext).toHaveBeenCalledTimes(1)
  })

  it('resumes suspended context before playing', () => {
    const resumeMock = vi.fn().mockResolvedValue(undefined)

    function createSuspendedMockAudioContext() {
      return {
        state: 'suspended',
        currentTime: 0,
        resume: resumeMock,
        close: vi.fn().mockResolvedValue(undefined),
        createOscillator: vi.fn().mockReturnValue(mockOscillator),
        createGain: vi.fn().mockReturnValue(mockGainNode),
        destination: {},
      }
    }

    const SuspendedMockAudioContext = vi.fn().mockImplementation(function () {
      return createSuspendedMockAudioContext()
    }) as unknown as typeof AudioContext
    vi.stubGlobal('AudioContext', SuspendedMockAudioContext)

    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })

    act(() => {
      result.current.play()
    })

    expect(resumeMock).toHaveBeenCalledTimes(1)
  })

  it('plays alert tone at 800Hz for 0.4s', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })

    act(() => {
      result.current.play()
    })

    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(800, expect.any(Number))
    expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.001,
      expect.any(Number),
    )
    expect(mockOscillator.stop).toHaveBeenCalledWith(expect.any(Number))
  })

  it('plays error tone at 200Hz for 0.2s', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })

    act(() => {
      result.current.playError()
    })

    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(200, expect.any(Number))
    expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      0.001,
      expect.any(Number),
    )
    expect(mockOscillator.stop).toHaveBeenCalledWith(expect.any(Number))
  })

  it('does not playError when disabled', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.playError()
    })
    expect(AudioContext).not.toHaveBeenCalled()
  })

  it('does not playError when document is hidden', () => {
    const { result } = renderHook(() => useAudioAlerts())
    act(() => {
      result.current.toggle()
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })

    act(() => {
      result.current.playError()
    })
    expect(AudioContext).not.toHaveBeenCalled()
  })

  it('reads initial enabled state from localStorage', () => {
    store['bantayog.audio-alerts-enabled'] = 'true'
    const { result } = renderHook(() => useAudioAlerts())
    expect(result.current.enabled).toBe(true)
  })
})
