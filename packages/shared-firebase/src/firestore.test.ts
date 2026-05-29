import { describe, expect, it, vi } from 'vitest'

const mockCollection = vi.hoisted(() => vi.fn())
const mockQuery = vi.hoisted(() => vi.fn())
const mockOrderBy = vi.hoisted(() => vi.fn())
const mockLimit = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn())
const mockWhere = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  where: mockWhere,
  onSnapshot: mockOnSnapshot,
  doc: vi.fn(),
  getFirestore: vi.fn(),
}))

import { subscribeAlerts } from './firestore'

describe('subscribeAlerts', () => {
  it('orders by publishedAt and maps snapshot docs', () => {
    mockCollection.mockReturnValue({ _tag: 'collection' })
    mockOrderBy.mockReturnValue({ _tag: 'orderBy' })
    mockLimit.mockReturnValue({ _tag: 'limit' })
    mockWhere.mockReturnValue({ _tag: 'whereVisibility' })
    mockQuery.mockReturnValue({ _tag: 'query' })
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [
          {
            data: () => ({
              id: 'alert-1',
              title: 'Flood',
              body: 'Rise',
              severity: 'high',
              publishedAt: 1,
            }),
          },
        ],
      })
      return vi.fn()
    })

    const callback = vi.fn()
    subscribeAlerts({} as never, callback)

    expect(mockCollection).toHaveBeenCalledWith({}, 'alerts')
    expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'public')
    expect(mockOrderBy).toHaveBeenCalledWith('publishedAt', 'desc')
    expect(mockLimit).toHaveBeenCalledWith(5)
    expect(mockQuery).toHaveBeenCalledWith(
      { _tag: 'collection' },
      { _tag: 'whereVisibility' },
      { _tag: 'orderBy' },
      { _tag: 'limit' },
    )
    expect(callback).toHaveBeenCalledWith([
      {
        id: 'alert-1',
        title: 'Flood',
        body: 'Rise',
        severity: 'high',
        publishedAt: 1,
        publishedBy: '',
      },
    ])
  })

  it('maps backend-declared alert docs into citizen alert cards', () => {
    mockCollection.mockReturnValue({ _tag: 'collection' })
    mockOrderBy.mockReturnValue({ _tag: 'orderBy' })
    mockLimit.mockReturnValue({ _tag: 'limit' })
    mockWhere.mockReturnValue({ _tag: 'whereVisibility' })
    mockQuery.mockReturnValue({ _tag: 'query' })
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [
          {
            id: 'alert-doc-1',
            data: () => ({
              alertId: 'alert-1',
              hazardType: 'flood',
              message: '[TEST:run] Flood proof alert',
              declaredBy: 'admin-1',
              publishedAt: 1,
            }),
          },
        ],
      })
      return vi.fn()
    })

    const callback = vi.fn()
    subscribeAlerts({} as never, callback)

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'alert-1',
        title: 'Flood Alert',
        body: '[TEST:run] Flood proof alert',
        severity: 'high',
        publishedAt: 1,
        publishedBy: 'admin-1',
      },
    ])
  })
})
