import { beforeEach, describe, expect, it, vi } from 'vitest'

const capacitorState = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  removeWatcher: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: capacitorState.isNativePlatform,
  },
  registerPlugin: () => ({
    addWatcher: vi.fn(),
    removeWatcher: capacitorState.removeWatcher,
    openSettings: vi.fn(),
  }),
}))

vi.mock('@capacitor/device', () => ({
  Device: {
    getBatteryInfo: vi.fn(),
  },
}))

import { startTracking } from './telemetry-client'

describe('telemetry-client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capacitorState.isNativePlatform.mockReturnValue(false)
  })

  it('treats web geolocation denial as recoverable telemetry state', async () => {
    const watchPosition = vi.fn(
      (_success: PositionCallback, error?: PositionErrorCallback): number => {
        const deniedError: GeolocationPositionError = {
          code: 1,
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        }
        error?.(deniedError)
        return 42
      },
    )
    const clearWatch = vi.fn()
    const originalGeolocation = navigator.geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
      configurable: true,
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      const stop = await startTracking('dispatch-1', vi.fn())
      await stop()

      expect(consoleWarn).toHaveBeenCalledWith(
        '[telemetry-client] web geolocation unavailable:',
        1,
        'User denied Geolocation',
      )
      expect(consoleError).not.toHaveBeenCalled()
      expect(clearWatch).toHaveBeenCalledWith(42)
    } finally {
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true,
      })
      consoleError.mockRestore()
      consoleWarn.mockRestore()
    }
  })
})
