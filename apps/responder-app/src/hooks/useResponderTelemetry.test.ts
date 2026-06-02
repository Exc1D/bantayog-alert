import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockSet = vi.hoisted(() => vi.fn())
const mockSetDoc = vi.hoisted(() => vi.fn())
const mockStartTracking = vi.hoisted(() => vi.fn())
const mockStopTracking = vi.hoisted(() => vi.fn())
const mockGetBatteryPercentage = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({
  db: {},
  rtdb: {},
}))
vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ path: 'responder_locations/uid-1' })),
  set: mockSet,
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'responders/uid-1' })),
  setDoc: mockSetDoc,
}))
vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ claims: { municipalityId: 'daet', agencyId: 'BFP' } }),
}))
vi.mock('../services/telemetry-client', () => ({
  startTracking: mockStartTracking,
  stopTracking: mockStopTracking,
  getBatteryPercentage: mockGetBatteryPercentage,
}))
vi.mock('@bantayog/shared-validators', () => ({
  responderTelemetryPayloadSchema: { parse: (x: unknown) => x },
}))

import { useResponderTelemetry } from './useResponderTelemetry'

describe('useResponderTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSet.mockResolvedValue(undefined)
    mockSetDoc.mockResolvedValue(undefined)
    mockGetBatteryPercentage.mockResolvedValue(100)
    mockStartTracking.mockImplementation((_dispatchId, handler) => {
      // Simulate two location updates — fast then slow — so interval throttling is exercised
      handler({ lat: 14.0, lng: 122.0, accuracy: 10, speed: 5.0, capturedAt: Date.now() })
      setTimeout(() => {
        handler({ lat: 14.001, lng: 122.001, accuracy: 8, speed: 0.0, capturedAt: Date.now() })
      }, 50)
      return Promise.resolve()
    })
  })

  it('starts tracking when uid, dispatchId, and active status are present', async () => {
    renderHook(() => {
      useResponderTelemetry('uid-1', 'disp-1', 'en_route')
    })
    await vi.waitFor(() => {
      expect(mockStartTracking).toHaveBeenCalledWith('disp-1', expect.any(Function))
    })
  })

  it('writes location and lastTelemetryAt to RTDB and Firestore', async () => {
    renderHook(() => {
      useResponderTelemetry('uid-1', 'disp-1', 'en_route')
    })
    await vi.waitFor(() => {
      expect(mockSet).toHaveBeenCalled()
    })
    expect(mockSetDoc).toHaveBeenCalled()
  })

  it('does not write again within the interval window (throttling)', async () => {
    renderHook(() => {
      useResponderTelemetry('uid-1', 'disp-1', 'en_route')
    })
    await vi.waitFor(() => {
      // First (moving) handler writes to responder_locations AND responder_index
      expect(mockSet).toHaveBeenCalledTimes(2)
    })
    // Second (still) location update arrives after 50ms but is throttled
    // because the 15_000ms moving interval has not elapsed.
    expect(mockSet).toHaveBeenCalledTimes(2)
  })

  it('stops tracking when status changes to non-active', async () => {
    const { rerender } = renderHook(
      ({ status }: { status: string }) => {
        useResponderTelemetry('uid-1', 'disp-1', status)
      },
      {
        initialProps: { status: 'en_route' },
      },
    )
    await vi.waitFor(() => {
      expect(mockStartTracking).toHaveBeenCalled()
    })
    rerender({ status: 'resolved' })
    await vi.waitFor(() => {
      expect(mockStopTracking).toHaveBeenCalled()
    })
  })
})
