import { useCallback, useRef, useState, useEffect } from 'react'

const STORAGE_KEY = 'bantayog.audio-alerts-enabled'
const ALERT_FREQUENCY = 800 // Hz
const ALERT_DURATION = 200 // ms

export function useAudioAlerts() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch (err) {
      console.warn('[useAudioAlerts] localStorage read failed', err)
      return false
    }
  })
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (enabled) {
      try {
        ctxRef.current = new AudioContext()
      } catch (err) {
        console.warn('[useAudioAlerts] AudioContext init failed', err)
        ctxRef.current = null
      }
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
    const stopTime = ctx.currentTime + ALERT_DURATION / 1000 + 0.01
    osc.type = 'sine'
    osc.frequency.setValueAtTime(ALERT_FREQUENCY, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0, stopTime)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(stopTime)
  }, [enabled])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch (err) {
        console.warn('[useAudioAlerts] localStorage write failed', err)
      }
      return next
    })
  }, [])

  return { enabled, toggle, play }
}
