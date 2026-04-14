/**
 * useSOS Hook Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSOS } from '../useSOS'

// ── Mock firebase/firestore — stable via vi.hoisted() ────────────────────────

const runTransactionMock = vi.hoisted(() => vi.fn())
const docMock = vi.hoisted(() => vi.fn((_db: unknown, _col: string, id: string) => ({ id })))
const collectionMock = vi.hoisted(() => vi.fn((_db: unknown, name: string) => ({ colName: name })))
const arrayUnionMock = vi.hoisted(() => vi.fn((...args: unknown[]) => args))
const getFirestoreMock = vi.hoisted(() => vi.fn(() => ({})))

const getAuthMock = vi.hoisted(() => vi.fn(() => ({ currentUser: { uid: 'responder-123' } })))

vi.mock('firebase/firestore', () => ({
  runTransaction: runTransactionMock,
  doc: docMock,
  collection: collectionMock,
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
        get: vi.fn(),
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

      expect(result.current.error?.code).toBe('VALIDATION_FAILED')
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
      validateGPSLocationMock.mockReturnValueOnce({
        valid: false,
        code: 'INVALID_COORDS',
        message: 'Invalid GPS coordinates (0,0)',
      })

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      expect(result.current.error?.code).toBe('VALIDATION_FAILED')
      expect(result.current.error?.message).toBe('Invalid GPS coordinates (0,0)')
    })
  })

  describe('cancelSOS', () => {
    it('should cancel SOS within window', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn(),
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
                cancellationWindowEndsAt: Date.now() + 30000,
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
        get: vi.fn(),
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

  describe('initial state', () => {
    it('should have correct initial state values', () => {
      const { result } = renderHook(() => useSOS())

      expect(result.current.sosState).toBe(null)
      expect(result.current.error).toBe(null)
      expect(result.current.locationSharing).toBe(false)
      expect(result.current.canCancel).toBe(false)
    })

    it('should expose all required return values', () => {
      const { result } = renderHook(() => useSOS())

      expect(result.current).toHaveProperty('activateSOS')
      expect(result.current).toHaveProperty('cancelSOS')
      expect(result.current).toHaveProperty('sosState')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('locationSharing')
      expect(result.current).toHaveProperty('canCancel')
    })
  })

  describe('cancelSOS edge cases', () => {
    it('should set CANCEL_WINDOW_EXPIRED when SOS window has expired in transaction', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      }

      // Activate SOS first
      runTransactionMock.mockImplementation(
        async (_db: unknown, callback: (t: typeof mockTransaction) => Promise<void>) => {
          await callback(mockTransaction)
        }
      )

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      // Now mock a cancel that fails because window expired
      runTransactionMock.mockImplementation(async () => {
        throw new Error('Cancellation window has expired')
      })

      await act(async () => {
        await result.current.cancelSOS('False alarm')
      })

      expect(result.current.error?.code).toBe('CANCEL_WINDOW_EXPIRED')
    })

    it('should set CANCEL_WINDOW_EXPIRED when SOS document not found during cancel', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      }

      // Activate SOS first
      runTransactionMock.mockImplementation(
        async (_db: unknown, callback: (t: typeof mockTransaction) => Promise<void>) => {
          await callback(mockTransaction)
        }
      )

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      // Mock cancel where document is not found
      runTransactionMock.mockImplementation(async () => {
        throw new Error('SOS document not found')
      })

      await act(async () => {
        await result.current.cancelSOS('False alarm')
      })

      expect(result.current.error?.code).toBe('CANCEL_WINDOW_EXPIRED')
    })

    it('should set NETWORK_ERROR when cancel fails with generic network error', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      }

      // Activate SOS first
      runTransactionMock.mockImplementation(
        async (_db: unknown, callback: (t: typeof mockTransaction) => Promise<void>) => {
          await callback(mockTransaction)
        }
      )

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      // Mock cancel with network failure
      runTransactionMock.mockImplementation(async () => {
        throw new Error('Firestore unavailable')
      })

      await act(async () => {
        await result.current.cancelSOS('False alarm')
      })

      expect(result.current.error?.code).toBe('NETWORK_ERROR')
    })
  })

  describe('activateSOS state transitions', () => {
    it('should set sosState to active after successful activation', async () => {
      const mockTransaction = {
        set: vi.fn(),
        get: vi.fn(),
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
      expect(result.current.sosState).not.toBeNull()
      expect(result.current.sosState?.status).toBe('active')
    })

    it('should not set locationSharing when offline validation fails', async () => {
      canActivateSOSMock.mockResolvedValue({
        valid: false,
        code: 'SOS_OFFLINE',
        message: 'No internet connection',
      })

      const { result } = renderHook(() => useSOS())

      await act(async () => {
        await result.current.activateSOS()
      })

      expect(result.current.locationSharing).toBe(false)
      expect(result.current.sosState).toBe(null)
    })
  })
})