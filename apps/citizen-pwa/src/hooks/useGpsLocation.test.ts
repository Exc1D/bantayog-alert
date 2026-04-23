import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

import { useGpsLocation } from './useGpsLocation.js'

describe('useGpsLocation', () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGetCurrentPosition = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
      writable: true,
    })
    vi.spyOn(console, 'error').mockImplementation(() => {
      return void 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with isLoading false and null state', () => {
    const { result } = renderHook(() => useGpsLocation())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.location).toBeNull()
    expect(result.current.locationMethod).toBeNull()
    expect(result.current.locationError).toBeNull()
  })

  it('sets isLoading true during attempt', () => {
    mockGetCurrentPosition.mockImplementation(() => {
      // intentionally never resolve so loading stays true
    })
    const { result } = renderHook(() => useGpsLocation())
    act(() => {
      void result.current.attemptGps()
    })
    expect(result.current.isLoading).toBe(true)
  })

  it('resolves with location on successful GPS', async () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 14.1, longitude: 122.9 },
      } as GeolocationPosition)
    })
    const { result } = renderHook(() => useGpsLocation())
    await act(async () => {
      await result.current.attemptGps()
    })
    expect(result.current.location).toEqual({ lat: 14.1, lng: 122.9 })
    expect(result.current.locationMethod).toBe('gps')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.locationError).toBeNull()
  })

  it('handles permission denied (code 1)', async () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1 } as GeolocationPositionError)
      },
    )
    const { result } = renderHook(() => useGpsLocation())
    await act(async () => {
      await result.current.attemptGps()
    })
    expect(result.current.locationError).toBe(
      'Location access denied. Choose municipality manually.',
    )
    expect(result.current.locationMethod).toBe('manual')
    expect(result.current.isLoading).toBe(false)
  })

  it('handles timeout (code 3)', async () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 3 } as GeolocationPositionError)
      },
    )
    const { result } = renderHook(() => useGpsLocation())
    await act(async () => {
      await result.current.attemptGps()
    })
    expect(result.current.locationError).toBe('Location timed out. Choose municipality manually.')
    expect(result.current.locationMethod).toBe('manual')
    expect(result.current.isLoading).toBe(false)
  })

  it('resetGps clears location, method, and error', async () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 14.1, longitude: 122.9 },
      } as GeolocationPosition)
    })
    const { result } = renderHook(() => useGpsLocation())
    await act(async () => {
      await result.current.attemptGps()
    })
    expect(result.current.location).not.toBeNull()

    act(() => {
      result.current.resetGps()
    })
    expect(result.current.location).toBeNull()
    expect(result.current.locationMethod).toBeNull()
    expect(result.current.locationError).toBeNull()
  })

  it('auto-attempts on mount when enabled', async () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 14.1, longitude: 122.9 },
      } as GeolocationPosition)
    })
    const { result } = renderHook(() => useGpsLocation(true))
    await waitFor(() => {
      expect(result.current.location).not.toBeNull()
    })
    expect(result.current.location).toEqual({ lat: 14.1, lng: 122.9 })
    expect(result.current.locationMethod).toBe('gps')
    expect(result.current.isLoading).toBe(false)
  })

  it('does not auto-attempt on mount when disabled', () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 14.1, longitude: 122.9 },
      } as GeolocationPosition)
    })
    const { result } = renderHook(() => useGpsLocation(false))
    expect(result.current.location).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(mockGetCurrentPosition).not.toHaveBeenCalled()
  })

  it('handles missing navigator.geolocation', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    const { result } = renderHook(() => useGpsLocation())
    await act(async () => {
      await result.current.attemptGps()
    })
    expect(result.current.locationError).toBe('GPS not supported on this device.')
    expect(result.current.locationMethod).toBe('manual')
    expect(result.current.isLoading).toBe(false)
  })

  it('logs error to console on failure', async () => {
    const fakeErr = new Error('boom')
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error(fakeErr as unknown as GeolocationPositionError)
      },
    )
    const { result } = renderHook(() => useGpsLocation())
    await act(async () => {
      await result.current.attemptGps()
    })
    expect(console.error).toHaveBeenCalledWith('[useGpsLocation] attemptGps failed:', fakeErr)
  })
})
