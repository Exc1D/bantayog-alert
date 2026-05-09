import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AudioAlertManager } from '../audio'

// Mock AudioContext class factory
function createMockAudioContext() {
  const mockOscillator = {
    start: vi.fn(),
    stop: vi.fn(),
    connect: vi.fn(),
    frequency: { setValueAtTime: vi.fn() },
  }

  const mockGainNode = {
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn() },
  }

  return {
    instance: {
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGainNode),
      destination: {},
      close: vi.fn(),
      currentTime: 0,
    },
    oscillator: mockOscillator,
  }
}

describe('AudioAlertManager', () => {
  let mockOscillator: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    connect: ReturnType<typeof vi.fn>
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> }
  }
  let mockAudioContextInstance: {
    createOscillator: ReturnType<typeof vi.fn>
    createGain: ReturnType<typeof vi.fn>
    destination: Record<string, unknown>
    close: ReturnType<typeof vi.fn>
    currentTime: number
  }

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
    }
    vi.stubGlobal('localStorage', localStorageMock)

    // Mock AudioContext
    const mockCtx = createMockAudioContext()
    mockOscillator = mockCtx.oscillator
    mockAudioContextInstance = mockCtx.instance

    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    vi.stubGlobal(
      'AudioContext',
      class MockAudioContext {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_options?: unknown) {
          return mockAudioContextInstance
        }
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize muted', () => {
    const manager = new AudioAlertManager()
    expect(manager.isEnabled()).toBe(false)
  })

  it('should enable audio', () => {
    const manager = new AudioAlertManager()
    manager.enable()
    expect(manager.isEnabled()).toBe(true)
  })

  it('should disable audio', () => {
    const manager = new AudioAlertManager()
    manager.enable()
    manager.disable()
    expect(manager.isEnabled()).toBe(false)
  })

  it('should not play when muted', () => {
    const manager = new AudioAlertManager()
    manager.play('critical-incident')
    expect(mockOscillator.start).not.toHaveBeenCalled()
  })

  it('should play critical-incident pattern when enabled', () => {
    const manager = new AudioAlertManager()
    manager.enable()
    manager.play('critical-incident')

    expect(mockOscillator.start).toHaveBeenCalled()
  })

  it('should snooze for specified duration', () => {
    vi.useFakeTimers()
    const manager = new AudioAlertManager()
    manager.snooze(5 * 60 * 1000) // 5 minutes

    expect(manager.isSnoozed()).toBe(true)

    // Should NOT play even when enabled during snooze
    manager.enable()
    manager.play('critical-incident')
    expect(mockOscillator.start).not.toHaveBeenCalled()

    // Critical events should still play
    manager.play('threshold-breach', true)
    expect(mockOscillator.start).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('should respect critical override on snooze', () => {
    vi.useFakeTimers()
    const manager = new AudioAlertManager()
    manager.enable()
    manager.snooze(5 * 60 * 1000)

    // Non-critical should be suppressed
    manager.play('responder-dispatched')
    expect(mockOscillator.start).not.toHaveBeenCalled()

    // Critical should play regardless
    manager.play('threshold-breach', true)
    expect(mockOscillator.start).toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})
