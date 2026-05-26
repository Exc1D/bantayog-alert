import { useCallback, useRef, useState } from 'react'

const STORAGE_KEY = 'bantayog.audio-alerts-enabled'

interface ToneConfig {
  frequency: number
  duration: number
}

const ALERT_TONE: ToneConfig = { frequency: 800, duration: 0.4 }
const ERROR_TONE: ToneConfig = { frequency: 200, duration: 0.2 }

function playTone(ctx: AudioContext, { frequency, duration }: ToneConfig) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

function getAudioContext(ctxRef: React.RefObject<AudioContext | null>): AudioContext {
  ctxRef.current ??= new AudioContext()
  const ctx = ctxRef.current
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}

export function useAudioAlerts() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const ctxRef = useRef<AudioContext | null>(null)

  const play = useCallback(() => {
    if (!enabled || document.visibilityState === 'hidden') return
    playTone(getAudioContext(ctxRef), ALERT_TONE)
  }, [enabled])

  const playError = useCallback(() => {
    if (!enabled || document.visibilityState === 'hidden') return
    playTone(getAudioContext(ctxRef), ERROR_TONE)
  }, [enabled])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { enabled, toggle, play, playError }
}
