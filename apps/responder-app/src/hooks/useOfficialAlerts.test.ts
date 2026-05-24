import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())
const mockQuery = vi.hoisted(() => vi.fn())
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
  orderBy: mockOrderBy,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
}))

import { useOfficialAlerts } from './useOfficialAlerts'

describe('useOfficialAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollection.mockReturnValue({ _tag: 'collection' })
    mockOrderBy.mockImplementation((...args) => ({ _tag: 'orderBy', args }))
    mockLimit.mockImplementation((...args) => ({ _tag: 'limit', args }))
    mockQuery.mockImplementation((...parts) => ({ _tag: 'query', parts }))
  })

  it('subscribes to official alerts ordered by newest publish time', () => {
    mockOnSnapshot.mockReturnValue(vi.fn())

    renderHook(() => useOfficialAlerts())

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'alerts')
    expect(mockOrderBy).toHaveBeenCalledWith('publishedAt', 'desc')
    expect(mockLimit).toHaveBeenCalledWith(20)
    expect(mockQuery).toHaveBeenCalledWith(
      { _tag: 'collection' },
      { _tag: 'orderBy', args: ['publishedAt', 'desc'] },
      { _tag: 'limit', args: [20] },
    )
  })

  it('maps Firestore alert documents into official alert items', async () => {
    mockOnSnapshot.mockImplementation((_q, onNext) => {
      onNext({
        docs: [
          {
            id: 'alert-1',
            data: () => ({
              message: 'Signal no. 3 raised',
              hazardType: 'typhoon',
              affectedMunicipalityIds: ['daet', 'mercedes'],
              declaredAt: { toMillis: () => 1_700_000_000_000 },
              publishedAt: 1_700_000_060_000,
              declaredBy: 'admin-1',
            }),
          },
        ],
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useOfficialAlerts())

    await waitFor(() => {
      expect(result.current.alerts).toHaveLength(1)
    })
    expect(result.current.alerts[0]).toEqual({
      id: 'alert-1',
      message: 'Signal no. 3 raised',
      hazardType: 'typhoon',
      affectedMunicipalityIds: ['daet', 'mercedes'],
      declaredAtMillis: 1_700_000_000_000,
      publishedAtMillis: 1_700_000_060_000,
      declaredBy: 'admin-1',
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('keeps the last successful alerts visible when the listener errors', async () => {
    mockOnSnapshot.mockImplementation((_q, onNext, onError) => {
      onNext({
        docs: [
          {
            id: 'alert-1',
            data: () => ({
              message: 'Flood alert',
              hazardType: 'flood',
              affectedMunicipalityIds: ['daet'],
              declaredAt: 1000,
              publishedAt: 1000,
              declaredBy: 'admin-1',
            }),
          },
        ],
      })
      onError(new Error('permission_denied'))
      return vi.fn()
    })

    const { result } = renderHook(() => useOfficialAlerts())

    await waitFor(() => {
      expect(result.current.error).toBe('permission_denied')
    })
    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.alerts[0]?.id).toBe('alert-1')
    expect(result.current.loading).toBe(false)
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    mockOnSnapshot.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useOfficialAlerts())
    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
