import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIncidentSubscription } from './useIncidentSubscription'

const mockOnSnapshot = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
}))

function createMockSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
  }
}

function createMockError(message: string) {
  return new Error(message)
}

describe('useIncidentSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty incidents and loading true on mount', () => {
    mockOnSnapshot.mockImplementation((_query: unknown, callback: (snap: unknown) => void) => {
      // Simulate async nature of Firebase onSnapshot
      setTimeout(() => {
        callback(createMockSnapshot([]))
      }, 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useIncidentSubscription())
    expect(result.current.incidents).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('parses valid incident documents into IncidentFeedItem format', async () => {
    const mockDocs = [
      {
        id: 'report-001',
        data: {
          status: 'verified',
          severity: 'high',
          reportType: 'flood',
          municipalityLabel: 'Basud',
          municipalityId: 'basud',
          publicLocation: { lat: 14.1, lng: 122.8 },
          createdAt: {
            toDate: () => new Date('2026-05-08T10:00:00Z'),
          },
        },
      },
      {
        id: 'report-002',
        data: {
          status: 'new',
          severity: 'critical',
          reportType: 'fire',
          municipalityLabel: 'Daet',
          municipalityId: 'daet',
          publicLocation: { lat: 14.05, lng: 122.95 },
          createdAt: {
            toDate: () => new Date('2026-05-08T11:00:00Z'),
          },
        },
      },
    ]

    mockOnSnapshot.mockImplementation((_query: unknown, callback: (snap: unknown) => void) => {
      callback(createMockSnapshot(mockDocs))
      return vi.fn()
    })

    const { result } = renderHook(() => useIncidentSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.incidents).toHaveLength(2)
    expect(result.current.incidents[0]!.id).toBe('report-001')
    expect(result.current.incidents[0]!.severity).toBe('high')
    expect(result.current.incidents[0]!.type).toBe('flood')
    expect(result.current.incidents[0]!.municipality).toBe('Basud')
    expect(result.current.incidents[0]!.location).toEqual({ lat: 14.1, lng: 122.8 })
    expect(result.current.incidents[1]!.id).toBe('report-002')
    expect(result.current.incidents[1]!.severity).toBe('critical')
  })

  it('skips documents without valid publicLocation', async () => {
    const mockDocs = [
      {
        id: 'report-001',
        data: {
          status: 'verified',
          severity: 'high',
          reportType: 'flood',
          municipalityLabel: 'Basud',
          publicLocation: { lat: 14.1, lng: 122.8 },
          createdAt: { toDate: () => new Date() },
        },
      },
      {
        id: 'report-002-no-location',
        data: {
          status: 'new',
          severity: 'critical',
          reportType: 'fire',
          municipalityLabel: 'Daet',
          publicLocation: null,
          createdAt: { toDate: () => new Date() },
        },
      },
      {
        id: 'report-003-partial-location',
        data: {
          status: 'assigned',
          severity: 'medium',
          reportType: 'medical',
          municipalityLabel: 'Mercedes',
          publicLocation: { lat: 14.0 },
          createdAt: { toDate: () => new Date() },
        },
      },
    ]

    mockOnSnapshot.mockImplementation((_query: unknown, callback: (snap: unknown) => void) => {
      callback(createMockSnapshot(mockDocs))
      return vi.fn()
    })

    const { result } = renderHook(() => useIncidentSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.incidents).toHaveLength(1)
    expect(result.current.incidents[0]!.id).toBe('report-001')
  })

  it('handles onSnapshot error callback', async () => {
    mockOnSnapshot.mockImplementation(
      (
        _query: unknown,
        callback: (snap: unknown) => void,
        errorCallback?: (err: Error) => void,
      ) => {
        errorCallback?.(createMockError('Firestore unavailable'))
        return vi.fn()
      },
    )

    const { result } = renderHook(() => useIncidentSubscription())

    await waitFor(() => {
      expect(result.current.error).toBe('Firestore unavailable')
      expect(result.current.loading).toBe(false)
    })
  })

  it('normalizes severity values to valid enum values', async () => {
    const mockDocs = [
      {
        id: 'report-critical',
        data: {
          status: 'verified',
          severity: 'CRITICAL',
          reportType: 'flood',
          municipalityLabel: 'Basud',
          publicLocation: { lat: 14.1, lng: 122.8 },
          createdAt: { toDate: () => new Date() },
        },
      },
      {
        id: 'report-invalid-severity',
        data: {
          status: 'new',
          severity: 'SUPER_HIGH',
          reportType: 'fire',
          municipalityLabel: 'Daet',
          publicLocation: { lat: 14.05, lng: 122.95 },
          createdAt: { toDate: () => new Date() },
        },
      },
      {
        id: 'report-null-severity',
        data: {
          status: 'assigned',
          severity: null,
          reportType: 'medical',
          municipalityLabel: 'Mercedes',
          publicLocation: { lat: 14.0, lng: 122.7 },
          createdAt: { toDate: () => new Date() },
        },
      },
    ]

    mockOnSnapshot.mockImplementation((_query: unknown, callback: (snap: unknown) => void) => {
      callback(createMockSnapshot(mockDocs))
      return vi.fn()
    })

    const { result } = renderHook(() => useIncidentSubscription())

    await waitFor(() => {
      expect(result.current.incidents).toHaveLength(3)
    })

    expect(result.current.incidents[0]!.severity).toBe('critical')
    expect(result.current.incidents[1]!.severity).toBe('medium')
    expect(result.current.incidents[2]!.severity).toBe('medium')
  })

  it('falls back to municipalityId when municipalityLabel is missing', async () => {
    const mockDocs = [
      {
        id: 'report-001',
        data: {
          status: 'verified',
          severity: 'high',
          reportType: 'flood',
          municipalityId: 'labo-muni-id',
          publicLocation: { lat: 14.1, lng: 122.8 },
          createdAt: { toDate: () => new Date() },
        },
      },
    ]

    mockOnSnapshot.mockImplementation((_query: unknown, callback: (snap: unknown) => void) => {
      callback(createMockSnapshot(mockDocs))
      return vi.fn()
    })

    const { result } = renderHook(() => useIncidentSubscription())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.incidents[0]!.municipality).toBe('labo-muni-id')
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useIncidentSubscription())
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
