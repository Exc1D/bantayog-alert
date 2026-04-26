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

const subscribers = new Set<(loc: TelemetryLocation) => void>()
let watcherId: string | null = null
let webWatchId: number | null = null

export async function startTracking(
  _dispatchId: string,
  onLocation: (loc: TelemetryLocation) => void,
): Promise<() => Promise<void>> {
  subscribers.add(onLocation)

  if (subscribers.size > 1) {
    return async () => {
      await stopTracking(onLocation)
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'Tracking active dispatch…',
          backgroundTitle: 'Bantayog Alert',
          distanceFilter: 10,
          requestPermissions: true,
        },
        (location?: Location, error?: CallbackError) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              console.error('[telemetry-client] location permission denied:', error.message)
              void BackgroundGeolocation.openSettings()
            } else {
              console.error('[telemetry-client] location error:', error.message)
            }
            return
          }
          if (!location) return
          const loc: TelemetryLocation = {
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy,
            speed: location.speed,
            capturedAt: location.time ?? Date.now(),
          }
          for (const subscriber of subscribers) {
            subscriber(loc)
          }
        },
      )
    } catch (err: unknown) {
      console.error('[telemetry-client] addWatcher failed:', err)
      subscribers.delete(onLocation)
      throw err
    }
    return async () => {
      await stopTracking(onLocation)
    }
  }

  // Web fallback — geolocation may be absent in non-HTTPS or restricted environments
  const geo = navigator.geolocation as Geolocation | undefined
  if (!geo) {
    subscribers.delete(onLocation)
    throw new Error('Geolocation not supported')
  }

  webWatchId = geo.watchPosition(
    (position) => {
      const loc: TelemetryLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        capturedAt: position.timestamp,
      }
      for (const subscriber of subscribers) {
        subscriber(loc)
      }
    },
    (err) => {
      console.error('[telemetry-client] web geolocation error:', err.message)
    },
    { enableHighAccuracy: true, maximumAge: 10000 },
  )

  return async () => {
    await stopTracking(onLocation)
  }
}

export async function stopTracking(onLocation?: (loc: TelemetryLocation) => void): Promise<void> {
  if (onLocation) {
    subscribers.delete(onLocation)
  }
  if (subscribers.size > 0) return

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
