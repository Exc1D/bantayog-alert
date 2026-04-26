import { Capacitor, registerPlugin } from '@capacitor/core'
import { Device } from '@capacitor/device'
import type {
  BackgroundGeolocationPlugin,
  Location,
  CallbackError,
} from '@capacitor-community/background-geolocation'

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

export interface TelemetryLocation {
  lat: number
  lng: number
  accuracy: number
  speed: number | null
  capturedAt: number
}

let refCount = 0
let currentCallback: ((loc: TelemetryLocation) => void) | null = null
let watcherId: string | null = null
let webWatchId: number | null = null

export async function startTracking(
  _dispatchId: string,
  onLocation: (loc: TelemetryLocation) => void,
): Promise<void> {
  refCount++
  currentCallback = onLocation

  if (refCount > 1) {
    // Already tracking; just updated callback
    return
  }

  if (Capacitor.isNativePlatform()) {
    try {
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking active dispatch…',
          backgroundTitle: 'Bantayog Alert',
          distanceFilter: 10,
        },
        (location?: Location, error?: CallbackError) => {
          if (error) {
            console.error('[telemetry-client] location error:', error.message)
            return
          }
          if (!location) return
          currentCallback?.({
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
            speed: location.speed,
            capturedAt: location.time ?? Date.now(),
          })
        },
      )
    } catch (err: unknown) {
      console.error('[telemetry-client] addWatcher failed:', err)
      refCount--
      throw err
    }
    return
  }

  // Web fallback — geolocation may be absent in non-HTTPS or restricted environments
  const geo = navigator.geolocation as Geolocation | undefined
  if (!geo) {
    refCount--
    throw new Error('Geolocation not supported')
  }

  webWatchId = geo.watchPosition(
    (position) => {
      currentCallback?.({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        capturedAt: position.timestamp,
      })
    },
    (err) => {
      console.error('[telemetry-client] web geolocation error:', err.message)
    },
    { enableHighAccuracy: true, maximumAge: 10000 },
  )
}

export async function stopTracking(): Promise<void> {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) return

  currentCallback = null

  if (watcherId) {
    try {
      await BackgroundGeolocation.removeWatcher({ id: watcherId })
    } catch (err: unknown) {
      console.error('[telemetry-client] removeWatcher failed:', err)
    }
    watcherId = null
  }

  if (webWatchId !== null) {
    navigator.geolocation.clearWatch(webWatchId)
    webWatchId = null
  }
}

export async function getBatteryPercentage(): Promise<number> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getBatteryInfo()
      if (typeof info.batteryLevel === 'number') {
        return Math.round(info.batteryLevel * 100)
      }
    } catch (err: unknown) {
      console.warn('[telemetry-client] battery read failed:', err)
    }
    return 100
  }

  // Web fallback
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ level: number }>
  }
  if (typeof nav.getBattery === 'function') {
    try {
      const battery = await nav.getBattery()
      if (typeof battery.level === 'number') {
        return Math.round(battery.level * 100)
      }
    } catch (err: unknown) {
      console.warn('[telemetry-client] web battery read failed:', err)
    }
  }
  return 100
}
