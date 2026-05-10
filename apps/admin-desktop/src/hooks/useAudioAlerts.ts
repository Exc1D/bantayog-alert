import { useCallback, useRef, useState } from 'react'

const STORAGE_KEY = 'bantayog.audio-alerts-enabled'
const ALERT_FREQUENCY = 800 // Hz
const ALERT_DURATION = 0.4 // seconds
const ERROR_FREQUENCY = 200 // Hz
const ERROR_DURATION = 0.2 // seconds

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
    if (!enabled) return
    if (document.visibilityState === 'hidden') return

    ctxRef.current ??= new AudioContext()
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(ALERT_FREQUENCY, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ALERT_DURATION)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + ALERT_DURATION)
  }, [enabled])

  const playError = useCallback(() => {
    if (!enabled) return
    if (document.visibilityState === 'hidden') return

    ctxRef.current ??= new AudioContext()
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(ERROR_FREQUENCY, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ERROR_DURATION)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + ERROR_DURATION)
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
