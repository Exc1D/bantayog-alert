import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const { mockLoadReports, mockUpdateReportId } = vi.hoisted(() => ({
  mockLoadReports: vi.fn(),
  mockUpdateReportId: vi.fn(),
}))

vi.mock('../services/localForageReports.js', () => ({
  loadReports: mockLoadReports,
  updateReportId: mockUpdateReportId,
}))

interface SnapshotEmitter {
  next(snap: { exists: () => boolean; data?: () => unknown }): void
  error(err: { code?: string; message?: string }): void
  unsubscribed: boolean
}

const { mockOnSnapshot, mockDoc, snapshotsByPath } = vi.hoisted(() => {
  const snapshotsByPath = new Map<string, SnapshotEmitter[]>()
  return {
    snapshotsByPath,
    mockDoc: vi.fn((_db: unknown, collection: string, id: string) => `${collection}/${id}`),
    mockOnSnapshot: vi.fn(
      (
        path: string,
        next: (snap: { exists: () => boolean; data?: () => unknown }) => void,
        error: (err: { code?: string; message?: string }) => void,
      ) => {
        const emitter: SnapshotEmitter = {
          next,
          error,
          unsubscribed: false,
        }
        const list = snapshotsByPath.get(path) ?? []
        list.push(emitter)
        snapshotsByPath.set(path, list)
        return () => {
          emitter.unsubscribed = true
        }
      },
    ),
  }
})

vi.mock('firebase/firestore', () => ({
  onSnapshot: mockOnSnapshot,
  doc: mockDoc,
}))

const { mockRequestLookup, mockHttpsCallable, mockFns } = vi.hoisted(() => ({
  mockRequestLookup: vi.fn(),
  mockHttpsCallable: vi.fn(),
  mockFns: vi.fn().mockReturnValue({}),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}))

const { mockHasFirebaseConfig } = vi.hoisted(() => ({
  mockHasFirebaseConfig: vi.fn().mockReturnValue(true),
}))

vi.mock('../services/firebase.js', () => ({
  db: vi.fn().mockReturnValue({}),
  fns: mockFns,
  hasFirebaseConfig: mockHasFirebaseConfig,
}))

import { useMyActiveReports } from './useMyActiveReports.js'

function emit(path: string, snap: { exists: () => boolean; data?: () => unknown }): void {
  const list = snapshotsByPath.get(path) ?? []
  for (const emitter of list) emitter.next(snap)
}

function emitError(path: string, err: { code?: string; message?: string }): void {
  const list = snapshotsByPath.get(path) ?? []
  for (const emitter of list) emitter.error(err)
}

beforeEach(() => {
  mockLoadReports.mockReset()
  mockUpdateReportId.mockReset().mockResolvedValue(undefined)
  mockOnSnapshot.mockClear()
  snapshotsByPath.clear()
  mockDoc.mockClear()
  mockRequestLookup.mockReset()
  mockHttpsCallable.mockReset().mockReturnValue(mockRequestLookup)
  mockFns.mockReset().mockReturnValue({})
  mockHasFirebaseConfig.mockReset().mockReturnValue(true)
})

describe('useMyActiveReports', () => {
  it('returns empty array when localForage is empty', async () => {
    mockLoadReports.mockResolvedValue([])
    const { result } = renderHook(() => useMyActiveReports())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.reports).toEqual([])
  })

  it('returns queued local reports when firebase is not configured', async () => {
    mockHasFirebaseConfig.mockReturnValue(false)
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'local-1',
        secret: 'sec',
        reportType: 'accident',
        severity: 'low',
        lat: 14.2,
        lng: 122.7,
        submittedAt: 2500,
      },
    ])

    const { result } = renderHook(() => useMyActiveReports())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.reports).toEqual([
      expect.objectContaining({
        publicRef: 'local-1',
        status: 'queued',
      }),
    ])
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it('seeds queued status while waiting for backend confirmation', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'pending1',
        secret: 'sec',
        reportType: 'flood',
        severity: 'medium',
        lat: 14.0,
        lng: 122.0,
        submittedAt: 100,
      },
    ])

    const { result } = renderHook(() => useMyActiveReports())

    await waitFor(() => {
      expect(snapshotsByPath.has('report_lookup/pending1')).toBe(true)
    })

    expect(result.current.reports).toEqual([
      expect.objectContaining({ publicRef: 'pending1', status: 'queued' }),
    ])

    // Lookup doc not yet materialised → emit non-existent snap; loading flips
    act(() => {
      emit('report_lookup/pending1', { exists: () => false })
    })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('subscribes to reports/{id} once lookup resolves and pushes live status', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'abcd1234',
        secret: 'sec',
        reportType: 'flood',
        severity: 'high',
        lat: 14.1,
        lng: 122.9,
        submittedAt: 1000,
      },
    ])

    const { result } = renderHook(() => useMyActiveReports())

    await waitFor(() => {
      expect(snapshotsByPath.has('report_lookup/abcd1234')).toBe(true)
    })

    act(() => {
      emit('report_lookup/abcd1234', {
        exists: () => true,
        data: () => ({ reportId: 'firestore-id-1' }),
      })
    })

    await waitFor(() => {
      expect(snapshotsByPath.has('reports/firestore-id-1')).toBe(true)
    })

    // First reports snapshot — status: 'new'
    act(() => {
      emit('reports/firestore-id-1', {
        exists: () => true,
        data: () => ({
          status: 'new',
          municipalityLabel: 'Daet',
          submittedAt: 1000,
          updatedAt: 1000,
        }),
      })
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.reports[0]?.status).toBe('new')
    expect(result.current.reports[0]?.id).toBe('firestore-id-1')
    expect(result.current.reports[0]?.municipalityLabel).toBe('Daet')

    // Admin verifies — status flips to 'verified'
    act(() => {
      emit('reports/firestore-id-1', {
        exists: () => true,
        data: () => ({
          status: 'verified',
          municipalityLabel: 'Daet',
          submittedAt: 1000,
          updatedAt: 2000,
          lastStatusAt: 2000,
        }),
      })
    })

    await waitFor(() => {
      expect(result.current.reports[0]?.status).toBe('verified')
    })

    expect(mockUpdateReportId).toHaveBeenCalledWith('abcd1234', 'firestore-id-1')
  })

  it('falls back to requestLookup callable when reports doc is permission-denied', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'denied01',
        secret: 'mySecret',
        reportType: 'fire',
        severity: 'high',
        lat: 14.0,
        lng: 122.0,
        submittedAt: 500,
      },
    ])
    mockRequestLookup.mockResolvedValue({
      data: { status: 'verified', lastStatusAt: 9000, municipalityLabel: 'Labo' },
    })

    const { result } = renderHook(() => useMyActiveReports())

    await waitFor(() => {
      expect(snapshotsByPath.has('report_lookup/denied01')).toBe(true)
    })

    act(() => {
      emit('report_lookup/denied01', {
        exists: () => true,
        data: () => ({ reportId: 'rid-denied' }),
      })
    })
    await waitFor(() => {
      expect(snapshotsByPath.has('reports/rid-denied')).toBe(true)
    })

    act(() => {
      emitError('reports/rid-denied', { code: 'permission-denied' })
    })

    await waitFor(() => {
      expect(mockRequestLookup).toHaveBeenCalledWith({
        publicRef: 'denied01',
        secret: 'mySecret',
      })
    })

    await waitFor(() => {
      expect(result.current.reports[0]?.status).toBe('verified')
    })
    expect(result.current.reports[0]?.municipalityLabel).toBe('Labo')
    expect(result.current.loading).toBe(false)
  })

  it('surfaces an error when Firestore and requestLookup both fail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'denied02',
        secret: 'mySecret',
        reportType: 'flood',
        severity: 'medium',
        lat: 14.0,
        lng: 122.0,
        submittedAt: 500,
      },
    ])
    mockRequestLookup.mockRejectedValue({ code: 'unavailable', message: 'offline' })

    try {
      const { result } = renderHook(() => useMyActiveReports())

      await waitFor(() => {
        expect(snapshotsByPath.has('report_lookup/denied02')).toBe(true)
      })

      act(() => {
        emit('report_lookup/denied02', {
          exists: () => true,
          data: () => ({ reportId: 'rid-denied-2' }),
        })
      })
      await waitFor(() => {
        expect(snapshotsByPath.has('reports/rid-denied-2')).toBe(true)
      })

      act(() => {
        emitError('reports/rid-denied-2', { code: 'permission-denied' })
      })

      await waitFor(() => {
        expect(result.current.status).toBe('error')
      })
      expect(result.current.error).toBe("We can't load your reports right now")
      expect(result.current.loading).toBe(false)
      expect(result.current.reports).toEqual([
        expect.objectContaining({ publicRef: 'denied02', status: 'queued' }),
      ])
      expect(consoleError).toHaveBeenCalledWith('[useMyActiveReports] callable fallback failed', {
        code: 'unavailable',
        message: 'offline',
      })
    } finally {
      consoleError.mockRestore()
    }
  })

  it('cleans up snapshot listeners on unmount', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'cleanup1',
        secret: 'sec',
        reportType: 'flood',
        severity: 'medium',
        lat: 14.0,
        lng: 122.0,
        submittedAt: 1,
      },
    ])

    const { unmount } = renderHook(() => useMyActiveReports())

    await waitFor(() => {
      expect(snapshotsByPath.has('report_lookup/cleanup1')).toBe(true)
    })
    act(() => {
      emit('report_lookup/cleanup1', {
        exists: () => true,
        data: () => ({ reportId: 'rid-1' }),
      })
    })
    await waitFor(() => {
      expect(snapshotsByPath.has('reports/rid-1')).toBe(true)
    })

    unmount()

    const lookupEmitters = snapshotsByPath.get('report_lookup/cleanup1') ?? []
    const reportEmitters = snapshotsByPath.get('reports/rid-1') ?? []
    expect(lookupEmitters.every((e) => e.unsubscribed)).toBe(true)
    expect(reportEmitters.every((e) => e.unsubscribed)).toBe(true)
  })
})
