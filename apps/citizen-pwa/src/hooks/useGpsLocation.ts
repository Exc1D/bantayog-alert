import { useState, useEffect, useCallback } from 'react'

export interface UseGpsLocationResult {
  location: { lat: number; lng: number } | null
  locationMethod: 'gps' | 'manual' | null
  gpsLoading: boolean
  locationError: string | null
  attemptGps: () => Promise<void>
  resetGps: () => void
}

/**
 * GPS location acquisition with fallback to manual entry.
 *
 * - `location` / `locationMethod` — set when GPS resolves successfully
 * - `gpsLoading` — true while waiting for navigator.geolocation
 * - `locationError` — human-readable message on failure; triggers manual mode
 * - `attemptGps()` — retry GPS on demand
 * - `resetGps()` — clear location state (e.g. when user switches input method)
 */
export function useGpsLocation(autoAttemptOnMount = false): UseGpsLocationResult {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationMethod, setLocationMethod] = useState<'gps' | 'manual' | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const attemptGps = useCallback(async () => {
    setLocationError(null)
    setGpsLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!navigator.geolocation) {
        setLocationError('GPS not supported on this device.')
        setLocationMethod('manual')
        return
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setLocationMethod('gps')
    } catch (err: unknown) {
      console.error('[useGpsLocation] attemptGps failed:', err)
      let msg = 'Could not get location. Choose municipality manually.'
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as GeolocationPositionError).code
        if (code === 1) msg = 'Location access denied. Choose municipality manually.'
        else if (code === 3) msg = 'Location timed out. Choose municipality manually.'
      }
      setLocationError(msg)
      setLocationMethod('manual')
    } finally {
      setGpsLoading(false)
    }
  }, [])

  const resetGps = useCallback(() => {
    setLocation(null)
    setLocationMethod(null)
    setLocationError(null)
  }, [])

  useEffect(() => {
    if (autoAttemptOnMount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void attemptGps()
    }
  }, [autoAttemptOnMount, attemptGps])

  return {
    location,
    locationMethod,
    gpsLoading,
    locationError,
    attemptGps,
    resetGps,
  }
}
