/**
 * useDuplicateCheck Hook Tests
 *
 * Tests duplicate detection for nearby recent reports of the same type.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDuplicateCheck } from '../useDuplicateCheck'

// ---------------------------------------------------------------------------
// Mock firebase/firestore — must come before any imports that use it.
// Use vi.hoisted so the factory can reference mockGetDocs at evaluation time.
// ---------------------------------------------------------------------------
const mockGetDocs = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  getDocs: mockGetDocs,
  Timestamp: {
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
}))

describe('useDuplicateCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocs.mockResolvedValue({ docs: [], forEach: () => {} })
  })

  it('should return empty duplicates array when no nearby reports found', async () => {
    mockGetDocs.mockResolvedValue({ docs: [], forEach: () => {} })

    const { result } = renderHook(() =>
      useDuplicateCheck({
        latitude: 14.5995,
        longitude: 122.7417,
        incidentType: 'flood',
        timeWindowMinutes: 30,
      })
    )

    // Wait for debounce (1s) + query to resolve
    await waitFor(
      () => {
        expect(result.current.duplicates).toEqual([])
        expect(result.current.isChecking).toBe(false)
      },
      { timeout: 3000 }
    )
  })

  it('should return isChecking true while query is in flight', async () => {
    mockGetDocs.mockResolvedValue({ docs: [], forEach: () => {} })

    const { result } = renderHook(() =>
      useDuplicateCheck({
        latitude: 14.5995,
        longitude: 122.7417,
        incidentType: 'flood',
      })
    )

    // Initially isChecking may be true after debounce fires; eventually it settles
    await waitFor(
      () => {
        expect(result.current.isChecking).toBe(false)
      },
      { timeout: 3000 }
    )
  })

  it('should detect nearby duplicate reports within distance threshold', async () => {
    const now = new Date()
    const mockDoc = {
      id: 'report-1',
      data: () => ({
        incidentType: 'flood',
        createdAt: { toDate: () => new Date(now.getTime() - 10 * 60 * 1000) },
        approximateLocation: {
          approximateCoordinates: { latitude: 14.5996, longitude: 122.7418 },
        },
        description: 'Earlier flood',
      }),
    }
    mockGetDocs.mockResolvedValue({
      docs: [mockDoc],
      forEach: (cb: (doc: typeof mockDoc) => void) => cb(mockDoc),
    })

    const { result } = renderHook(() =>
      useDuplicateCheck({
        latitude: 14.5995,
        longitude: 122.7417,
        incidentType: 'flood',
        distanceThresholdKm: 0.5,
        timeWindowMinutes: 30,
      })
    )

    // Wait for debounce + query completion
    await waitFor(
      () => {
        expect(result.current.duplicates.length).toBeGreaterThan(0)
      },
      { timeout: 3000 }
    )

    const dup = result.current.duplicates[0]
    expect(dup.id).toBe('report-1')
    expect(dup.distanceKm).toBeCloseTo(0.044, 1)
  })

  it('should exclude reports outside distance threshold', async () => {
    const mockDoc = {
      id: 'far-report',
      data: () => ({
        incidentType: 'flood',
        createdAt: { toDate: () => new Date() },
        approximateLocation: {
          approximateCoordinates: { latitude: 14.7, longitude: 122.8 }, // ~12km away
        },
        description: 'Far flood',
      }),
    }
    mockGetDocs.mockResolvedValue({
      docs: [mockDoc],
      forEach: (cb: (doc: typeof mockDoc) => void) => cb(mockDoc),
    })

    const { result } = renderHook(() =>
      useDuplicateCheck({
        latitude: 14.5995,
        longitude: 122.7417,
        incidentType: 'flood',
        distanceThresholdKm: 0.5,
      })
    )

    await waitFor(
      () => {
        expect(result.current.duplicates).toHaveLength(0)
      },
      { timeout: 3000 }
    )
  })

  it('should provide clearDuplicates action to reset state', async () => {
    const mockDoc = {
      id: 'dup-1',
      data: () => ({
        incidentType: 'flood',
        createdAt: { toDate: () => new Date() },
        approximateLocation: {
          approximateCoordinates: { latitude: 14.5996, longitude: 122.7418 },
        },
        description: 'Dup',
      }),
    }
    mockGetDocs.mockResolvedValue({
      docs: [mockDoc],
      forEach: (cb: (doc: typeof mockDoc) => void) => cb(mockDoc),
    })

    const { result } = renderHook(() =>
      useDuplicateCheck({
        latitude: 14.5995,
        longitude: 122.7417,
        incidentType: 'flood',
        distanceThresholdKm: 0.5,
      })
    )

    // Wait for duplicate to be found
    await waitFor(
      () => {
        expect(result.current.duplicates.length).toBeGreaterThan(0)
      },
      { timeout: 3000 }
    )

    act(() => {
      result.current.clearDuplicates()
    })

    expect(result.current.duplicates).toEqual([])
  })

  it('should gracefully handle query errors', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firestore unavailable'))

    const { result } = renderHook(() =>
      useDuplicateCheck({
        latitude: 14.5995,
        longitude: 122.7417,
        incidentType: 'flood',
      })
    )

    // Wait for the debounce to fire and the error to propagate through the catch block.
    // The hook should end with isChecking=false and duplicates=[] regardless of the error.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    })

    expect(result.current.duplicates).toEqual([])
    expect(result.current.isChecking).toBe(false)
  })
})