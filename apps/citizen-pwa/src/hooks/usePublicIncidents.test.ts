import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { mockHasFirebaseConfig } = vi.hoisted(() => ({
  mockHasFirebaseConfig: vi.fn().mockReturnValue(true),
}))

vi.mock('../services/firebase.js', () => ({
  db: vi.fn().mockReturnValue({}),
  hasFirebaseConfig: mockHasFirebaseConfig,
}))

const { mockOnSnapshot } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue('col'),
  query: vi.fn().mockReturnValue('q'),
  where: vi.fn().mockReturnValue('w'),
  orderBy: vi.fn().mockReturnValue('ob'),
  limit: vi.fn().mockReturnValue('lim'),
  onSnapshot: mockOnSnapshot,
}))

import { usePublicIncidents } from './usePublicIncidents.js'
import type { Filters } from '../components/MapTab/types.js'

function makeSnap(docs: object[]) {
  return {
    docs: docs.map((d, i) => ({
      id: 'id-' + String(i),
      data: () => d,
    })),
  }
}

const defaultFilters: Filters = { severity: 'all', window: '24h' }

beforeEach(() => {
  vi.clearAllMocks()
  mockHasFirebaseConfig.mockReturnValue(true)
  mockOnSnapshot.mockReturnValue(() => {
    return void 0
  })
})

describe('usePublicIncidents', () => {
  it('starts in loading state', () => {
    mockOnSnapshot.mockReturnValue(() => {
      return void 0
    })
    const { result } = renderHook(() => usePublicIncidents(defaultFilters))
    expect(result.current.loading).toBe(true)
    expect(result.current.incidents).toEqual([])
  })

  it('returns incidents from Firestore snapshot', () => {
    const doc = {
      reportType: 'flood',
      severity: 'high',
      status: 'verified',
      barangayId: 'brgy-1',
      municipalityLabel: 'Daet',
      publicLocation: { lat: 14.1, lng: 122.9 },
      submittedAt: 1000,
    }
    mockOnSnapshot.mockImplementation((_q: unknown, onNext: (snap: object) => void) => {
      onNext(makeSnap([doc]))
      return () => {
        return void 0
      }
    })
    const { result } = renderHook(() => usePublicIncidents(defaultFilters))
    expect(result.current.loading).toBe(false)
    expect(result.current.incidents).toHaveLength(1)
    expect(result.current.incidents[0]!.reportType).toBe('flood')
    expect(result.current.incidents[0]!.id).toBe('id-0')
  })

  it('filters by severity when not all', () => {
    const docs = [
      {
        reportType: 'flood',
        severity: 'high',
        status: 'verified',
        barangayId: 'b',
        municipalityLabel: 'Daet',
        publicLocation: { lat: 14, lng: 122 },
        submittedAt: 1000,
      },
      {
        reportType: 'fire',
        severity: 'low',
        status: 'verified',
        barangayId: 'b',
        municipalityLabel: 'Daet',
        publicLocation: { lat: 14, lng: 122 },
        submittedAt: 900,
      },
    ]
    mockOnSnapshot.mockImplementation((_q: unknown, onNext: (snap: object) => void) => {
      onNext(makeSnap(docs))
      return () => {
        return void 0
      }
    })
    const filters: Filters = { severity: 'high', window: '24h' }
    const { result } = renderHook(() => usePublicIncidents(filters))
    expect(result.current.incidents).toHaveLength(1)
    expect(result.current.incidents[0]!.reportType).toBe('flood')
  })

  it('sets error when onSnapshot calls onError', () => {
    const fakeErr = new Error('permission denied')
    mockOnSnapshot.mockImplementation(
      (_q: unknown, _onNext: unknown, onErr: (err: Error) => void) => {
        onErr(fakeErr)
        return () => {
          return void 0
        }
      },
    )
    const { result } = renderHook(() => usePublicIncidents(defaultFilters))
    expect(result.current.error).toBe(fakeErr)
    expect(result.current.loading).toBe(false)
  })

  it('falls back to empty data when firebase is not configured', async () => {
    mockHasFirebaseConfig.mockReturnValue(false)
    const { result } = renderHook(() => usePublicIncidents(defaultFilters))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.incidents).toEqual([])
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })
})
