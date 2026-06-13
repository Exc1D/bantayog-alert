import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockCollection = vi.hoisted(() =>
  vi.fn().mockImplementation((_db: unknown, path: string) => ({ kind: 'collection', path })),
)
const mockQuery = vi.hoisted(() =>
  vi.fn().mockImplementation((ref, ...constraints) => ({ kind: 'query', ref, constraints })),
)
const mockWhere = vi.hoisted(() =>
  vi.fn().mockImplementation((field, op, value) => ({ kind: 'where', field, op, value })),
)
const mockOrderBy = vi.hoisted(() =>
  vi.fn().mockImplementation((field, dir) => ({ kind: 'orderBy', field, dir })),
)
const mockLimit = vi.hoisted(() => vi.fn().mockImplementation((n) => ({ kind: 'limit', n })))
const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: useAuthMock,
}))

import { useDispatchLifecycle } from './useDispatchLifecycle'

const mockDb = {} as never

interface WhereCall {
  field: string
  op: string
  value: unknown
}

function whereCalls(): WhereCall[] {
  return mockWhere.mock.calls.map(([field, op, value]) => ({
    field: field as string,
    op: op as string,
    value,
  }))
}

describe('useDispatchLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSnapshot.mockReturnValue(mockUnsubscribe)
  })

  it('initializes with loading state reflecting authLoading', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const { result } = renderHook(() => useDispatchLifecycle(mockDb))

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.rows).toEqual([])
  })

  it('sets up two onSnapshot listeners (dispatches + dispatch_events)', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useDispatchLifecycle(mockDb))

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'dispatches')
    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'dispatch_events')
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
  })

  it('scopes dispatches by municipalityId for municipal_admin', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useDispatchLifecycle(mockDb))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'municipalityId', op: '==', value: 'M001' })
  })

  it('scopes dispatches by agencyId for agency_admin', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'agency-1' },
      claims: { role: 'agency_admin', agencyId: 'A001' },
      loading: false,
    })

    renderHook(() => useDispatchLifecycle(mockDb))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'agencyId', op: '==', value: 'A001' })
  })

  it('provincial_superadmin leaves dispatches unscoped', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'super-1' },
      claims: { role: 'provincial_superadmin' },
      loading: false,
    })

    renderHook(() => useDispatchLifecycle(mockDb))

    const calls = whereCalls()
    expect(calls.filter((c) => c.field === 'municipalityId' || c.field === 'agencyId').length).toBe(
      0,
    )
  })

  it('merges dispatches and events into rows with timeline', async () => {
    vi.useFakeTimers()
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const now = Date.now()

    let dispatchesCallback:
      | ((snap: { docs: { id: string; data: () => unknown }[] }) => void)
      | null = null
    let eventsCallback: ((snap: { docs: { id: string; data: () => unknown }[] }) => void) | null =
      null

    function getCollectionPath(ref: unknown): string | undefined {
      const r = ref as { kind?: string; path?: string; ref?: unknown }
      if (r.kind === 'collection' && typeof r.path === 'string') return r.path
      if (r.ref) return getCollectionPath(r.ref)
      return undefined
    }

    mockOnSnapshot.mockImplementation((ref: unknown, next: unknown) => {
      const path = getCollectionPath(ref)
      if (path === 'dispatches') {
        dispatchesCallback = next as typeof dispatchesCallback
      } else {
        eventsCallback = next as typeof eventsCallback
      }
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useDispatchLifecycle(mockDb))

    await act(async () => {
      dispatchesCallback?.({
        docs: [
          {
            id: 'd1',
            data: () => ({
              reportId: 'r1',
              status: 'pending',
              responderName: 'Alice',
              responderAgency: 'BFP',
              dispatchedAt: now - 3600_000,
              deadlineAt: now + 7200_000,
              resolvedAt: now - 120_000,
              resolutionSummary: 'Route cleared and responder released.',
              escalationCount: 0,
              fcmResult: null,
              fcmWarnings: null,
            }),
          },
        ],
      })
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(result.current.rows).toHaveLength(1)

    await act(async () => {
      eventsCallback?.({
        docs: [
          {
            id: 'ev1',
            data: () => ({
              type: 'dispatched',
              dispatchId: 'd1',
              at: now - 3500_000,
              payload: { foo: 'bar' },
            }),
          },
          {
            id: 'ev2',
            data: () => ({
              type: 'accepted',
              dispatchId: 'd1',
              at: now - 3000_000,
            }),
          },
        ],
      })
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(result.current.rows[0]?.timeline).toHaveLength(2)
    expect(result.current.rows[0]?.resolvedAt).toBe(now - 120_000)
    expect(result.current.rows[0]?.resolutionSummary).toBe('Route cleared and responder released.')
    expect(result.current.rows[0]?.timeline[0]).toMatchObject({ id: 'ev2', type: 'accepted' })
    expect(result.current.rows[0]?.timeline[1]).toMatchObject({ id: 'ev1', type: 'dispatched' })

    vi.useRealTimers()
  })

  it('filters events older than 24 hours for the dispatch_events query', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const beforeMount = Date.now()
    renderHook(() => useDispatchLifecycle(mockDb))
    const afterMount = Date.now()

    const calls = whereCalls()
    const atCall = calls.find((c) => c.field === 'at')
    expect(atCall).toBeDefined()
    expect(atCall?.op).toBe('>')
    const atValue = atCall?.value as number
    expect(atValue).toBeGreaterThanOrEqual(beforeMount - 24 * 60 * 60 * 1000)
    expect(atValue).toBeLessThanOrEqual(afterMount - 24 * 60 * 60 * 1000)
  })

  it('sets error state when a listener fails', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      if (onError) {
        onError(new Error('permission denied'))
      }
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useDispatchLifecycle(mockDb))

    expect(result.current.error).toBe('permission denied')
    expect(result.current.loading).toBe(false)
  })

  it('returns unauthorized error for unsupported role', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'r1' },
      claims: { role: 'responder' },
      loading: false,
    })

    const { result } = renderHook(() => useDispatchLifecycle(mockDb))

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.error).toBe('unauthorized')
    expect(result.current.loading).toBe(false)
    expect(result.current.rows).toEqual([])
  })

  it('returns unauthorized error for municipal_admin without municipalityId', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin' },
      loading: false,
    })

    const { result } = renderHook(() => useDispatchLifecycle(mockDb))

    expect(result.current.error).toBe('unauthorized')
  })

  it('returns unauthorized error for agency_admin without agencyId', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'agency-1' },
      claims: { role: 'agency_admin' },
      loading: false,
    })

    const { result } = renderHook(() => useDispatchLifecycle(mockDb))

    expect(result.current.error).toBe('unauthorized')
  })

  it('defers listener setup while auth is loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      claims: null,
      loading: true,
    })

    const { result } = renderHook(() => useDispatchLifecycle(mockDb))

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('unsubscribes listeners on unmount', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const { unmount } = renderHook(() => useDispatchLifecycle(mockDb))

    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2)
  })

  it('status filter uses IN with allowed statuses', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useDispatchLifecycle(mockDb))

    const calls = whereCalls()
    const statusCall = calls.find((c) => c.field === 'status')
    expect(statusCall).toBeDefined()
    expect(statusCall?.op).toBe('in')
    expect(statusCall?.value).toEqual([
      'pending',
      'accepted',
      'acknowledged',
      'en_route',
      'on_scene',
      'resolved',
      'declined',
      'needs_admin',
      'escalated',
    ])
  })

  it('orders dispatches by dispatchedAt DESC with limit 100', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useDispatchLifecycle(mockDb))

    expect(mockOrderBy).toHaveBeenCalledWith('dispatchedAt', 'desc')
    expect(mockLimit).toHaveBeenCalledWith(100)
  })

  it('orders dispatch_events by at DESC', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useDispatchLifecycle(mockDb))

    expect(mockOrderBy).toHaveBeenCalledWith('at', 'desc')
  })
})
