import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

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
const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: useAuthMock,
}))

import { useResponderFleet } from './useResponderFleet'

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

describe('useResponderFleet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSnapshot.mockReturnValue(mockUnsubscribe)
  })

  it('initializes with loading state reflecting authLoading', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.responders).toEqual([])
  })

  it('sets up onSnapshot on responders collection', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useResponderFleet(mockDb))

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'responders')
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
  })

  it('scopes by municipalityId for municipal_admin', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useResponderFleet(mockDb))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'municipalityId', op: '==', value: 'M001' })
  })

  it('scopes by agencyId for agency_admin', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'agency_admin', agencyId: 'A001' },
      loading: false,
    })

    renderHook(() => useResponderFleet(mockDb))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'agencyId', op: '==', value: 'A001' })
  })

  it('provincial_superadmin leaves unscoped', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'super-1' },
      claims: { role: 'provincial_superadmin' },
      loading: false,
    })

    renderHook(() => useResponderFleet(mockDb))

    const calls = whereCalls()
    expect(calls.filter((c) => c.field === 'municipalityId' || c.field === 'agencyId').length).toBe(
      0,
    )
  })

  it('filters by availabilityStatus == available', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useResponderFleet(mockDb))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'availabilityStatus', op: '==', value: 'available' })
  })

  it('filters by accountStatus == active', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useResponderFleet(mockDb))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'accountStatus', op: '==', value: 'active' })
  })

  it('filters by lastSeenAt > now - 5 minutes', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const beforeMount = Date.now()
    renderHook(() => useResponderFleet(mockDb))
    const afterMount = Date.now()

    const calls = whereCalls()
    const lastSeenCall = calls.find((c) => c.field === 'lastSeenAt')
    expect(lastSeenCall).toBeDefined()
    expect(lastSeenCall?.op).toBe('>')
    const value = lastSeenCall?.value as number
    expect(value).toBeGreaterThanOrEqual(beforeMount - 5 * 60 * 1000)
    expect(value).toBeLessThanOrEqual(afterMount - 5 * 60 * 1000)
  })

  it('orders by lastSeenAt DESC', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useResponderFleet(mockDb))

    expect(mockOrderBy).toHaveBeenCalledWith('lastSeenAt', 'desc')
  })

  it('derives online status correctly', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const now = Date.now()
    let callback: ((snap: { docs: { id: string; data: () => unknown }[] }) => void) | null = null

    mockOnSnapshot.mockImplementation((_ref: unknown, next: unknown) => {
      callback = next as typeof callback
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    act(() => {
      callback?.({
        docs: [
          {
            id: 'r1',
            data: () => ({
              displayName: 'Alice',
              availabilityStatus: 'available',
              lastSeenAt: now - 60_000,
            }),
          },
          {
            id: 'r2',
            data: () => ({
              displayName: 'Bob',
              availabilityStatus: 'available',
              lastSeenAt: now - 10 * 60_000,
            }),
          },
          {
            id: 'r3',
            data: () => ({
              displayName: 'Carol',
              availabilityStatus: 'available',
              lastSeenAt: now - 45 * 60_000,
            }),
          },
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.responders).toHaveLength(3)
    })

    expect(result.current.responders[0]).toMatchObject({ uid: 'r1', onlineStatus: 'online' })
    expect(result.current.responders[1]).toMatchObject({ uid: 'r2', onlineStatus: 'away' })
    expect(result.current.responders[2]).toMatchObject({ uid: 'r3', onlineStatus: 'offline' })
  })

  it('derives online status using exact thresholds', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const now = Date.now()
    let callback: ((snap: { docs: { id: string; data: () => unknown }[] }) => void) | null = null

    mockOnSnapshot.mockImplementation((_ref: unknown, next: unknown) => {
      callback = next as typeof callback
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    act(() => {
      callback?.({
        docs: [
          {
            id: 'r1',
            data: () => ({
              displayName: 'Alice',
              availabilityStatus: 'available',
              lastSeenAt: now - 5 * 60_000,
            }),
          },
          {
            id: 'r2',
            data: () => ({
              displayName: 'Bob',
              availabilityStatus: 'available',
              lastSeenAt: now - 30 * 60_000,
            }),
          },
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.responders).toHaveLength(2)
    })

    expect(result.current.responders[0]).toMatchObject({ uid: 'r1', onlineStatus: 'away' })
    expect(result.current.responders[1]).toMatchObject({ uid: 'r2', onlineStatus: 'offline' })
  })

  it('returns unauthorized error for unsupported role', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'r1' },
      claims: { role: 'responder' },
      loading: false,
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.error).toBe('unauthorized')
    expect(result.current.loading).toBe(false)
    expect(result.current.responders).toEqual([])
  })

  it('returns unauthorized error for municipal_admin without municipalityId', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin' },
      loading: false,
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    expect(result.current.error).toBe('unauthorized')
  })

  it('returns unauthorized error for agency_admin without agencyId', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'agency_admin' },
      loading: false,
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    expect(result.current.error).toBe('unauthorized')
  })

  it('defers listener setup while auth is loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      claims: null,
      loading: true,
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('unsubscribes listeners on unmount', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const { unmount } = renderHook(() => useResponderFleet(mockDb))

    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('sets error state when listener fails', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      if (onError) {
        onError(new Error('permission denied'))
      }
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    expect(result.current.error).toBe('permission denied')
    expect(result.current.loading).toBe(false)
  })

  it('maps Firestore data to ResponderFleetMember shape', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const now = Date.now()
    let callback: ((snap: { docs: { id: string; data: () => unknown }[] }) => void) | null = null

    mockOnSnapshot.mockImplementation((_ref: unknown, next: unknown) => {
      callback = next as typeof callback
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useResponderFleet(mockDb))

    act(() => {
      callback?.({
        docs: [
          {
            id: 'r1',
            data: () => ({
              displayName: 'Alice',
              availabilityStatus: 'available',
              lastSeenAt: now,
              municipalityId: 'M001',
              agencyId: 'A001',
            }),
          },
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.responders[0]).toMatchObject({
        uid: 'r1',
        displayName: 'Alice',
        availabilityStatus: 'available',
        lastSeenAt: now,
        municipalityId: 'M001',
        agencyId: 'A001',
        onlineStatus: 'online',
      })
    })
  })
})
