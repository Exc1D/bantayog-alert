/**
 * useSOS Hook Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSOS } from '../useSOS'
import { SOS_CANCELLATION_WINDOW_MS } from '../../config/urgency.config'

// ── Mock firebase/firestore — stable via vi.hoisted() ────────────────────────

const runTransactionMock = vi.hoisted(() => vi.fn())
const docMock = vi.hoisted(() => vi.fn((_db: unknown, _col: string, id: string) => ({ id })))
const collectionMock = vi.hoisted(() => vi.fn((_db: unknown, name: string) => ({ colName: name })))
const queryMock = vi.hoisted(() => vi.fn())
const whereMock = vi.hoisted(() => vi.fn())
const arrayUnionMock = vi.hoisted(() => vi.fn((...args: unknown[]) => args))
const getFirestoreMock = vi.hoisted(() => vi.fn(() => ({})))

const getAuthMock = vi.hoisted(() => vi.fn(() => ({ currentUser: { uid: 'responder-123' } })))

vi.mock('firebase/firestore', () => ({
  runTransaction: runTransactionMock,
  doc: docMock,
  collection: collectionMock,
  query: queryMock,
  where: whereMock,
  arrayUnion: arrayUnionMock,
  getFirestore: getFirestoreMock,
}))

vi.mock('firebase/auth', () => ({
  getAuth: getAuthMock,
}))

// ── Mock validation.service — stable via vi.hoisted() ───────────────────────

const canActivateSOSMock = vi.hoisted(() => vi.fn())
const validateGPSLocationMock = vi.hoisted(() => vi.fn())

vi.mock('../../services/validation.service', () => ({
  canActivateSOS: canActivateSOSMock,
  validateGPSLocation: validateGPSLocationMock,
}))

// ── Mock navigator.geolocation — synchronous watchPosition ────────────────────

let watchPositionCallback: ((pos: GeolocationPosition) => void) | null = null

vi.stubGlobal('navigator', {
  geolocation: {
    watchPosition: vi.fn((onSuccess: (pos: GeolocationPosition) => void) => {
      watchPositionCallback = onSuccess
      // Fire synchronously so locationCacheRef is populated before validateGPSLocation runs
      onSuccess({
        coords: {
          latitude: 14.2972,
          longitude: 122.7417,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)
      return 123
    }),
    getCurrentPosition: vi.fn(
      (onSuccess: (pos: GeolocationPosition) => void, _onError: () => void) => {
        onSuccess({
          coords: {
            latitude: 14.2972,
            longitude: 122.7417,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition)
      }
    ),
    clearWatch: vi.fn(),
  },
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSOS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    watchPositionCallback = null

    // Default mock return values
    canActivateSOSMock.mockResolvedValue({ valid: true })
    validateGPSLocationMock.mockReturnValue({ valid: true })
    runTransactionMock.mockReset()

    collectionMock.mockReturnValue({})
    docMock.mockReturnValue({ id: 'sos-id' })
    getFirestoreMock.mockReturnValue({})
    arrayUnionMock.mockImplementation((...args: unknown[]) => args)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('activateSOS', () => {
    it('should activate SOS and start location sharing', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn().mockResolvedValue({ empty: true }),
        update: vi.fn(),
      }
      runTransactionMock.mockImplementation(
        async (_db: unknown, callback: (t: typeof mockTransaction) => Promise<void>) => {
          await callback(mockTransaction)
        }
      )

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      expect(result.current.error).toBe(null)
      expect(result.current.locationSharing).toBe(true)
    })

    it('should prevent activation when offline', async () => {
      canActivateSOSMock.mockResolvedValue({
        valid: false,
        code: 'SOS_OFFLINE',
        message: 'SOS activation requires internet connection',
      })

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      // Validation code is now preserved ('SOS_OFFLINE') instead of hardcoded 'VALIDATION_FAILED'
      expect(result.current.error?.code).toBe('SOS_OFFLINE')
      expect(result.current.error?.message).toBe(
        'SOS activation requires internet connection'
      )
      expect(result.current.locationSharing).toBe(false)
    })

    it('should handle already active error', async () => {
      runTransactionMock.mockImplementation(async () => {
        throw new Error('SOS already active')
      })

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      expect(result.current.error?.code).toBe('ALREADY_ACTIVE')
      expect(result.current.error?.message).toBe('SOS already active')
    })

    it('should handle permission denied', async () => {
      runTransactionMock.mockImplementation(async () => {
        throw new Error('User not authenticated')
      })

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      expect(result.current.error?.code).toBe('PERMISSION_DENIED')
    })

    it('should handle network errors', async () => {
      runTransactionMock.mockImplementation(async () => {
        throw new Error('Firestore unavailable')
      })

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      expect(result.current.error?.code).toBe('NETWORK_ERROR')
    })

    it('should validate GPS coordinates before activation', async () => {
      // When locationCacheRef is null, the one-shot GPS fix is tried first.
      // If getCurrentPosition succeeds, validateGPSLocation is called with valid coords,
      // which would pass — so we need to make getCurrentPosition fail to exercise
      // the GPS_TIMEOUT error path. Alternatively, mock validateGPSLocation with a
      // bad location that still gets through getCurrentPosition.
      // Here we let getCurrentPosition succeed but validateGPSLocation fail.
      validateGPSLocationMock.mockReturnValueOnce({
        valid: false,
        code: 'INVALID_COORDS',
        message: 'Invalid GPS coordinates (0,0)',
      })

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      // GPS validation now returns INVALID_COORDS from the validator
      expect(result.current.error?.code).toBe('INVALID_COORDS')
      expect(result.current.error?.message).toBe('Invalid GPS coordinates (0,0)')
    })
  })

  describe('cancelSOS', () => {
    it('should cancel SOS within window', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn().mockResolvedValue({ empty: true }),
        update: vi.fn(),
      }
      runTransactionMock.mockImplementation(
        async (_db: unknown, callback: (t: typeof mockTransaction) => Promise<void>) => {
          await callback(mockTransaction)
        }
      )

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      expect(result.current.canCancel).toBe(true)

      runTransactionMock.mockImplementation(
        async (_db: unknown, callback: (t: typeof mockTransaction) => Promise<void>) => {
          const cancelTransaction = {
            set: vi.fn(),
            get: vi.fn().mockResolvedValue({
              exists: () => true,
              data: () => ({
                cancellationWindowEndsAt: Date.now() + SOS_CANCELLATION_WINDOW_MS,
              }),
            }),
            update: vi.fn(),
          }
          await callback(cancelTransaction)
        }
      )

      await act(async () => {
        await result.current.cancelSOS('False alarm')
      })

      expect(result.current.error).toBe(null)
      expect(global.navigator.geolocation.clearWatch).toHaveBeenCalled()
    })

    it('should reject cancel when no active SOS', async () => {
      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.cancelSOS('False alarm')
      })

      expect(result.current.error?.code).toBe('CANCEL_WINDOW_EXPIRED')
      expect(result.current.error?.message).toBe('No active SOS to cancel')
    })
  })

  describe('cleanup', () => {
    it('should cleanup geolocation on unmount', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn().mockResolvedValue({ empty: true }),
        update: vi.fn(),
      }
      runTransactionMock.mockImplementation(
        async (_db: unknown, callback: (t: typeof mockTransaction) => Promise<void>) => {
          await callback(mockTransaction)
        }
      )

      const { result, unmount } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      unmount()

      expect(global.navigator.geolocation.clearWatch).toHaveBeenCalled()
    })
  })
})
