import { useState, useEffect, useCallback } from 'react'

const PROBE_URL = '/__/firebase.json'
const PROBE_TIMEOUT_MS = 3_000
const PROBE_INTERVAL_MS = 10_000

/**
 * Active connectivity probe + passive navigator.onLine listeners.
 *
 * - `isOnline` (probe result) — used for RETRY decisions
 * - `navigatorOnline` (passive) — used for UI banner
 *
 * Why active probe? navigator.onLine is unreliable on mobile Safari —
 * it reports true even behind captive portals with no real connectivity.
 */
export function useOnlineStatus() {
  const [navigatorOnline, setNavigatorOnline] = useState(() => navigator.onLine)
  const [probeOnline, setProbeOnline] = useState(true)

  const probe = useCallback(async () => {
    if (!navigator.onLine) {
      setProbeOnline(false)
      return
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, PROBE_TIMEOUT_MS)
    try {
      await fetch(PROBE_URL, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      })
      setProbeOnline(true)
    } catch (_err: unknown) {
      void _err
      setProbeOnline(false)
    } finally {
      clearTimeout(timeoutId)
    }
  }, [])

  // Probe immediately on mount, then every 10s via setInterval.
  // setInterval avoids calling setState synchronously within the effect body (React lint rule)
  useEffect(() => {
    const scheduleProbe = () => {
      void probe()
    }

    scheduleProbe()
    const interval = setInterval(scheduleProbe, PROBE_INTERVAL_MS)
    return () => {
      clearInterval(interval)
    }
  }, [probe])

  // Passive listeners for immediate UI feedback
  useEffect(() => {
    const on = () => {
      setNavigatorOnline(true)
    }
    const off = () => {
      setNavigatorOnline(false)
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return {
    isOnline: probeOnline,
    navigatorOnline,
  }
}
