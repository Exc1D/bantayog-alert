import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockOnValue = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockCollection = vi.hoisted(() => vi.fn().mockReturnValue({ kind: 'collection' }))
const mockQuery = vi.hoisted(() =>
  vi.fn().mockImplementation((ref, ...constraints) => ({ kind: 'query', ref, constraints })),
)
const mockWhere = vi.hoisted(() =>
  vi.fn().mockImplementation((field, op, value) => ({ kind: 'where', field, op, value })),
)
const mockRef = vi.hoisted(() => vi.fn().mockReturnValue({ kind: 'rtdb-ref' }))
const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: vi.fn(),
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  where: mockWhere,
}))

vi.mock('firebase/database', () => ({
  ref: mockRef,
  onValue: mockOnValue,
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: useAuthMock,
}))

import { useFirestoreListeners } from '../hooks/useFirestoreListeners'

const mockDb = {} as never
const mockRtdb = {} as never

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

describe('useFirestoreListeners — role scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSnapshot.mockReturnValue(mockUnsubscribe)
    mockOnValue.mockReturnValue(mockUnsubscribe)
  })

  it('provincial_superadmin: leaves reports + report_ops unscoped', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'super-1' },
      claims: { role: 'provincial_superadmin' },
      loading: false,
    })

    renderHook(() => useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }))

    expect(mockWhere).not.toHaveBeenCalled()
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3)
  })

  it('municipal_admin: scopes reports + report_ops by municipalityId', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'municipalityId', op: '==', value: 'M001' })
    expect(calls.filter((c) => c.field === 'municipalityId').length).toBeGreaterThanOrEqual(2)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3)
  })

  it('agency_admin: reports filter by agencyId, report_ops use array-contains on agencyIds', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'agency-1' },
      claims: { role: 'agency_admin', agencyId: 'A001' },
      loading: false,
    })

    renderHook(() => useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }))

    const calls = whereCalls()
    expect(calls).toContainEqual({ field: 'agencyId', op: '==', value: 'A001' })
    expect(calls).toContainEqual({ field: 'agencyIds', op: 'array-contains', value: 'A001' })
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3)
  })

  it('alerts listener is never scoped (public read)', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    renderHook(() => useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }))

    // Reports + report_ops subscribe through constrained Queries; alerts must
    // receive the plain collection ref so it stays unscoped (public read).
    const alertsCall = mockOnSnapshot.mock.calls.find((call) => {
      const ref = call[0] as { kind?: string } | undefined
      return ref?.kind === 'collection'
    })
    expect(alertsCall).toBeDefined()

    // Sanity: the other two listeners ARE constrained, so this isn't vacuous.
    const queryCalls = mockOnSnapshot.mock.calls.filter((call) => {
      const ref = call[0] as { kind?: string } | undefined
      return ref?.kind === 'query'
    })
    expect(queryCalls).toHaveLength(2)
  })

  it('rejects unsupported role and clears any prior cached data', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'rogue-1' },
      claims: { role: 'responder', municipalityId: 'M001' },
      loading: false,
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.error).toBe('unauthorized')
    expect(result.current.loading).toBe(false)
    expect(result.current.reports).toEqual([])
    expect(result.current.reportOps).toEqual([])
    expect(result.current.alerts).toEqual([])
    expect(result.current.responders).toEqual([])
  })

  it('defers listener setup while auth is still loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      claims: null,
      loading: true,
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('missing claims: skips listener setup and surfaces unauthorized error', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'user-1' },
      claims: null,
      loading: false,
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('unauthorized')
  })

  it('municipal_admin without municipalityId: skips listener setup', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin' },
      loading: false,
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.error).toBe('unauthorized')
  })

  it('agency_admin without agencyId: skips listener setup', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'agency-1' },
      claims: { role: 'agency_admin' },
      loading: false,
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(result.current.error).toBe('unauthorized')
  })
})
