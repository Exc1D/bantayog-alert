import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())
const mockQuery = vi.hoisted(() => vi.fn())
const mockWhere = vi.hoisted(() => vi.fn())
const mockOrderBy = vi.hoisted(() => vi.fn())
const mockLimit = vi.hoisted(() => vi.fn())
const mockCollection = vi.hoisted(() => vi.fn())
const mockDb = vi.hoisted(() => ({}))

vi.mock('../app/firebase', () => ({
  db: mockDb,
}))
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
}))

import { usePublicFeed } from './usePublicFeed'

describe('usePublicFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollection.mockReturnValue({ _tag: 'collection' })
    mockWhere.mockImplementation((...args) => ({ _tag: 'where', args }))
    mockOrderBy.mockImplementation((...args) => ({ _tag: 'orderBy', args }))
    mockLimit.mockImplementation((...args) => ({ _tag: 'limit', args }))
    mockQuery.mockImplementation((...parts) => ({ _tag: 'query', parts }))
  })

  it('subscribes to public reports ordered by newest submitted time', () => {
    mockOnSnapshot.mockReturnValue(vi.fn())

    renderHook(() => usePublicFeed())

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'reports')
    expect(mockWhere).toHaveBeenCalledWith('visibilityClass', '==', 'public_alertable')
    expect(mockOrderBy).toHaveBeenCalledWith('submittedAt', 'desc')
    expect(mockLimit).toHaveBeenCalledWith(50)
    expect(mockQuery).toHaveBeenCalledWith(
      { _tag: 'collection' },
      { _tag: 'where', args: ['visibilityClass', '==', 'public_alertable'] },
      { _tag: 'orderBy', args: ['submittedAt', 'desc'] },
      { _tag: 'limit', args: [50] },
    )
  })

  it('maps Firestore report documents into UI-safe feed items', async () => {
    mockOnSnapshot.mockImplementation((_q, onNext) => {
      onNext({
        docs: [
          {
            id: 'report-1',
            data: () => ({
              reportType: 'flood',
              severity: 'high',
              status: 'verified',
              barangayId: 'Barangay 1',
              municipalityLabel: 'Daet',
              description: 'Water rising near the public market',
              publicLocation: { lat: 14.112, lng: 122.955 },
              submittedAt: { toMillis: () => 1_700_000_000_000 },
              verifiedAt: 1_700_000_060_000,
              featuredMediaUrls: ['https://cdn.example/photo.jpg'],
            }),
          },
        ],
      })
      return vi.fn()
    })

    const { result } = renderHook(() => usePublicFeed())

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })
    expect(result.current.items[0]).toEqual({
      id: 'report-1',
      reportType: 'flood',
      severity: 'high',
      status: 'verified',
      barangayId: 'Barangay 1',
      municipalityLabel: 'Daet',
      description: 'Water rising near the public market',
      publicLocation: { lat: 14.112, lng: 122.955 },
      submittedAtMillis: 1_700_000_000_000,
      verifiedAtMillis: 1_700_000_060_000,
      featuredMediaUrls: ['https://cdn.example/photo.jpg'],
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('keeps the last successful items visible when the listener errors', async () => {
    mockOnSnapshot.mockImplementation((_q, onNext, onError) => {
      onNext({
        docs: [
          {
            id: 'report-1',
            data: () => ({
              reportType: 'fire',
              severity: 'medium',
              status: 'verified',
              barangayId: 'Barangay 2',
              municipalityLabel: 'Basud',
              publicLocation: { lat: 14.1, lng: 122.8 },
              submittedAt: 1000,
            }),
          },
        ],
      })
      onError(new Error('permission_denied'))
      return vi.fn()
    })

    const { result } = renderHook(() => usePublicFeed())

    await waitFor(() => {
      expect(result.current.error).toBe('permission_denied')
    })
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0]?.id).toBe('report-1')
    expect(result.current.loading).toBe(false)
  })
})
