import { useCallback, useRef, useState, useEffect } from 'react'

const STORAGE_KEY = 'bantayog.audio-alerts-enabled'
const ALERT_FREQUENCY = 800 // Hz
const ALERT_DURATION = 200 // ms

export function useAudioAlerts() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (enabled) {
      ctxRef.current = new AudioContext()
    }
    return () => {
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [enabled])

  const play = useCallback(() => {
    if (!enabled || !ctxRef.current) return
    const ctx = ctxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(ALERT_FREQUENCY, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ALERT_DURATION / 1000)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + ALERT_DURATION / 1000)
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

  return { enabled, toggle, play }
}
