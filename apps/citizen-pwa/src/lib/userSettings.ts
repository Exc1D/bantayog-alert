const KEY_ALERT_SOUNDS = 'bantayog_alert_sounds'
const KEY_AUTO_LOCATION = 'bantayog_location_auto'
const KEY_OFFLINE_MODE = 'bantayog_offline_mode'

function readBool(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return raw === 'true'
  } catch {
    return defaultValue
  }
}

export function getAlertSoundsEnabled(): boolean {
  return readBool(KEY_ALERT_SOUNDS, true)
}

export function getAutoLocationEnabled(): boolean {
  return readBool(KEY_AUTO_LOCATION, true)
}

export function getOfflineModeEnabled(): boolean {
  return readBool(KEY_OFFLINE_MODE, false)
}

export const SETTINGS_KEYS = {
  alertSounds: KEY_ALERT_SOUNDS,
  autoLocation: KEY_AUTO_LOCATION,
  offlineMode: KEY_OFFLINE_MODE,
} as const
