import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useReportEvents } from '../hooks/useReportEvents'
import type { ReportEvent } from '@bantayog/shared-validators'

const { mockOnSnapshot } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: mockOnSnapshot,
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getFirestore: vi.fn(() => ({})),
}))

vi.mock('@/app/firebase', () => ({
  db: {},
}))

describe('useReportEvents', () => {
  beforeEach(() => {
    mockOnSnapshot.mockReset()
    vi.clearAllMocks()
  })

  it('returns loading state initially', () => {
    mockOnSnapshot.mockReturnValue(vi.fn())
    const { result } = renderHook(() => useReportEvents())

    expect(result.current.loading).toBe(true)
    expect(result.current.events).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns events when snapshot succeeds', async () => {
    const mockEvents: ReportEvent[] = [
      {
        reportId: 'report-1',
        municipalityId: 'daet',
        actor: 'admin@test.com',
        actorRole: 'municipal_admin',
        fromStatus: 'new',
        toStatus: 'verified',
        createdAt: Math.floor(Date.now() / 1000),
        correlationId: 'corr-1',
        schemaVersion: 1,
      },
      {
        reportId: 'report-2',
        municipalityId: 'basud',
        actor: 'superadmin@test.com',
        actorRole: 'provincial_superadmin',
        fromStatus: 'verified',
        toStatus: 'resolved',
        createdAt: Math.floor(Date.now() / 1000),
        correlationId: 'corr-2',
        schemaVersion: 1,
      },
    ]

    mockOnSnapshot.mockImplementation((_query, onNext) => {
      setTimeout(() => {
        const snap = {
          docs: mockEvents.map((event) => ({
            id: `event-${event.reportId}`,
            data: () => event,
          })),
        }
        onNext(snap)
      }, 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useReportEvents())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.events).toHaveLength(2)
    })

    expect(result.current.events[0]!.reportId).toBe('report-1')
    expect(result.current.events[0]!.id).toBe('event-report-1')
    expect(result.current.events[1]!.toStatus).toBe('resolved')
    expect(result.current.events[0]!.reportId).toBe('report-1')
    expect(result.current.events[1]!.toStatus).toBe('resolved')
    expect(result.current.error).toBeNull()
  })

  it('filters out malformed events', async () => {
    const mockEvents = [
      {
        reportId: 'report-1',
        municipalityId: 'daet',
        actor: 'admin@test.com',
        actorRole: 'municipal_admin',
        fromStatus: 'new',
        toStatus: 'verified',
        createdAt: Math.floor(Date.now() / 1000),
        correlationId: 'corr-1',
        schemaVersion: 1,
      },
      {
        reportId: 'report-invalid',
        // Missing required fields
        municipalityId: 'daet',
        actor: 'admin@test.com',
        actorRole: 'municipal_admin',
        fromStatus: 'invalid',
        toStatus: 'verified',
        createdAt: Math.floor(Date.now() / 1000),
        correlationId: 'corr-2',
        schemaVersion: 1,
      },
    ]

    mockOnSnapshot.mockImplementation((_query, onNext) => {
      setTimeout(() => {
        const snap = {
          docs: mockEvents.map((event) => ({
            id: `event-${event.reportId}`,
            data: () => event,
          })),
        }
        onNext(snap)
      }, 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useReportEvents())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.events).toHaveLength(1)
    })

    expect(result.current.events[0]!.reportId).toBe('report-1')
  })

  it('returns error when snapshot fails', async () => {
    const testError = new Error('Permission denied')
    mockOnSnapshot.mockImplementation((_query, _onNext, onError) => {
      onError(testError)
      return vi.fn()
    })

    const { result } = renderHook(() => useReportEvents())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Permission denied')
    expect(result.current.events).toEqual([])
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useReportEvents())

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('subscribes to municipality-scoped query when municipalityId provided', () => {
    const unsubscribe = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribe)

    renderHook(() => useReportEvents('daet'))

    expect(mockOnSnapshot).toHaveBeenCalled()
  })

  it('subscribes to global query when no municipalityId provided', () => {
    const unsubscribe = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribe)

    renderHook(() => useReportEvents())

    expect(mockOnSnapshot).toHaveBeenCalled()
  })
})
