import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())
const mockQuery = vi.hoisted(() => vi.fn())
const mockWhere = vi.hoisted(() => vi.fn())
const mockOrderBy = vi.hoisted(() => vi.fn())
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
  onSnapshot: mockOnSnapshot,
}))

import { useOwnDispatches } from './useOwnDispatches'

describe('useOwnDispatches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollection.mockReturnValue({ _tag: 'collection' })
    mockWhere.mockImplementation((...args) => ({ _tag: 'where', args }))
    mockOrderBy.mockImplementation((...args) => ({ _tag: 'orderBy', args }))
    mockQuery.mockImplementation((...parts) => ({ _tag: 'query', parts }))
  })

  it('returns empty rows when uid is undefined', async () => {
    const { result } = renderHook(() => useOwnDispatches(undefined))

    await waitFor(() => {
      expect(result.current.rows).toEqual([])
    })
    expect(result.current.groups.pending).toEqual([])
    expect(result.current.groups.active).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('groups pending and active dispatches separately', async () => {
    mockOnSnapshot.mockImplementation((_q, onNext) => {
      onNext({
        docs: [
          {
            id: 'disp-pending',
            data: () => ({
              reportId: 'rep-1',
              status: 'pending',
              dispatchedAt: { toMillis: () => 1000 },
            }),
          },
          {
            id: 'disp-active',
            data: () => ({
              reportId: 'rep-2',
              status: 'acknowledged',
              dispatchedAt: { toMillis: () => 2000 },
            }),
          },
        ],
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useOwnDispatches('uid-1'))

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2)
    })

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'dispatches')
    expect(mockWhere).toHaveBeenNthCalledWith(1, 'assignedTo.uid', '==', 'uid-1')
    expect(mockWhere).toHaveBeenNthCalledWith(2, 'status', 'in', [
      'pending',
      'accepted',
      'acknowledged',
      'en_route',
      'on_scene',
    ])
    expect(mockOrderBy).toHaveBeenCalledWith('dispatchedAt', 'desc')
    expect(mockQuery).toHaveBeenCalledWith(
      { _tag: 'collection' },
      { _tag: 'where', args: ['assignedTo.uid', '==', 'uid-1'] },
      {
        _tag: 'where',
        args: ['status', 'in', ['pending', 'accepted', 'acknowledged', 'en_route', 'on_scene']],
      },
      { _tag: 'orderBy', args: ['dispatchedAt', 'desc'] },
    )

    expect(result.current.groups.pending).toHaveLength(1)
    expect(result.current.groups.pending[0]!.dispatchId).toBe('disp-pending')
    expect(result.current.groups.active).toHaveLength(1)
    expect(result.current.groups.active[0]!.dispatchId).toBe('disp-active')
    expect(result.current.error).toBeNull()
  })

  it('surfaces error when Firestore listener fails', async () => {
    mockOnSnapshot.mockImplementation((_q, _onNext, onError) => {
      onError(new Error('permission_denied'))
      return vi.fn()
    })

    const { result } = renderHook(() => useOwnDispatches('uid-1'))

    await waitFor(() => {
      expect(result.current.error).toBe('permission_denied')
    })
    expect(result.current.rows).toEqual([])
  })
})
