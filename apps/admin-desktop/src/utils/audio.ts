export type AlertEvent =
  | 'critical-incident'
  | 'threshold-breach'
  | 'responder-dispatched'
  | 'connection-lost'

export type AudioState = 'off' | 'on' | 'snoozed'

interface AudioConfig {
  frequency: number
  duration: number
  pattern?: number[] // For beeps
  volume: number
}

// Audio patterns for different alert types
const ALERT_PATTERNS: Record<AlertEvent, AudioConfig> = {
  'critical-incident': {
    frequency: 880, // A5
    duration: 1200,
    pattern: [400, 400, 400], // 3 beeps, 400ms each
    volume: 0.3,
  },
  'threshold-breach': {
    frequency: 440, // A4
    duration: 2000,
    volume: 0.4,
  },
  'responder-dispatched': {
    frequency: 523.25, // C5
    duration: 1000,
    volume: 0.2,
  },
  'connection-lost': {
    frequency: 330, // E4
    duration: 100, // Short beep, repeats
    pattern: [1000], // 1s interval between repeats
    volume: 0.35,
  },
}

export class AudioAlertManager {
  private state: AudioState = 'off'
  private snoozeUntil: number | null = null
  private audioContext: AudioContext | null = null

  constructor() {
    // Check localStorage for persisted preference
    try {
      const saved = localStorage.getItem('bantayog-audio-state')
      if (saved === 'on') {
        this.state = 'on'
      }
    } catch {
      // localStorage not available (e.g., in tests or private browsing)
    }
  }

  isEnabled(): boolean {
    return this.state === 'on'
  }

  isSnoozed(): boolean {
    return this.state === 'snoozed' || (this.snoozeUntil !== null && Date.now() < this.snoozeUntil)
  }

  enable(): void {
    // Don't clear snooze if actively snoozed
    if (this.state !== 'snoozed') {
      this.state = 'on'
    }
    this.persist()
  }

  disable(): void {
    this.state = 'off'
    this.persist()
  }

  snooze(durationMs: number = 5 * 60 * 1000): void {
    this.state = 'snoozed'
    this.snoozeUntil = Date.now() + durationMs
    this.persist()

    // Auto-resume after snooze duration
    setTimeout(() => {
      if (this.snoozeUntil && Date.now() >= this.snoozeUntil) {
        this.state = 'on'
        this.snoozeUntil = null
        this.persist()
      }
    }, durationMs)
  }

  play(event: AlertEvent, isCritical = false): void {
    // Don't play if disabled
    if (this.state === 'off') {
      return
    }

    // Don't play if snoozed, unless it's a critical event
    if (this.isSnoozed() && !isCritical) {
      return
    }

    const config = ALERT_PATTERNS[event]
    this.playSound(config)
  }

  private playSound(config: AudioConfig): void {
    if (!this.audioContext) {
      // Support both standard and webkit-prefixed AudioContext

      const win = window as unknown as {
        AudioContext?: typeof AudioContext
        webkitAudioContext?: typeof AudioContext
      }
      const AudioContextClass = win.AudioContext ?? win.webkitAudioContext
      if (!AudioContextClass) {
        // AudioContext not available, silently fail
        return
      }
      this.audioContext = new AudioContextClass()
    }

    const ctx = this.audioContext
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime)
    gainNode.gain.setValueAtTime(config.volume, ctx.currentTime)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + config.duration / 1000)
  }

  private persist(): void {
    try {
      localStorage.setItem('bantayog-audio-state', this.state === 'snoozed' ? 'on' : this.state)
    } catch {
      // localStorage not available - ignore
    }
  }

  getState(): AudioState {
    // Check if snooze has expired
    if (this.state === 'snoozed' && this.snoozeUntil && Date.now() >= this.snoozeUntil) {
      this.state = 'on'
      this.snoozeUntil = null
    }
    return this.state
  }

  getSnoozeRemainingMs(): number | null {
    if (this.snoozeUntil === null) return null
    const remaining = this.snoozeUntil - Date.now()
    return remaining > 0 ? remaining : null
  }
}

// Singleton instance
export const audioManager = new AudioAlertManager()
