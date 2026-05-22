import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockOnValue = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockCollection = vi.hoisted(() =>
  vi.fn().mockImplementation((_db: unknown, path: string) => ({ kind: 'collection', path })),
)
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

  it('agency_admin: reports are unfiltered (rules gate access), report_ops use array-contains on agencyIds', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'agency-1' },
      claims: { role: 'agency_admin', agencyId: 'A001' },
      loading: false,
    })

    renderHook(() => useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }))

    const calls = whereCalls()
    // reports docs do not have agencyId; we query the full collection and
    // let Firestore rules enforce access (public_alertable + agency-linked).
    expect(calls).not.toContainEqual({ field: 'agencyId', op: '==', value: 'A001' })
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
    // Path-aware assertions guard against the failure mode where some *other*
    // collection (not alerts) is the one being read unscoped.
    const collectionCalls = mockOnSnapshot.mock.calls.filter((call) => {
      const ref = call[0] as { kind?: string; path?: string } | undefined
      return ref?.kind === 'collection'
    })
    expect(collectionCalls).toHaveLength(1)
    expect((collectionCalls[0]?.[0] as { path: string }).path).toBe('alerts')

    // Sanity: the other two listeners ARE constrained, and they wrap the
    // reports + report_ops collections specifically — not alerts.
    const queryCalls = mockOnSnapshot.mock.calls.filter((call) => {
      const ref = call[0] as { kind?: string } | undefined
      return ref?.kind === 'query'
    })
    expect(queryCalls).toHaveLength(2)
    const queriedPaths = queryCalls
      .map((call) => (call[0] as { ref: { path: string } }).ref.path)
      .sort()
    expect(queriedPaths).toEqual(['report_ops', 'reports'])
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

  it('flushes prior tenant data when scope key changes between valid scopes', () => {
    let reportsCallback: ((snap: { docs: { id: string; data: () => unknown }[] }) => void) | null =
      null
    mockOnSnapshot.mockImplementation((ref: unknown, next: unknown) => {
      const r = ref as { kind?: string }
      if (r.kind === 'query' && !reportsCallback) {
        reportsCallback = next as typeof reportsCallback
      }
      return mockUnsubscribe
    })

    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const { result, rerender } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    act(() => {
      reportsCallback?.({
        docs: [
          {
            id: 'r-m001',
            data: () => ({
              type: 'flood',
              severity: 'high',
              municipality: 'X',
              barangay: 'Y',
              createdAt: '00:00',
              status: 'new',
              description: 'd',
            }),
          },
        ],
      })
    })

    expect(result.current.reports).toHaveLength(1)

    useAuthMock.mockReturnValue({
      user: { uid: 'muni-2' },
      claims: { role: 'municipal_admin', municipalityId: 'M002' },
      loading: false,
    })

    act(() => {
      rerender()
    })

    expect(result.current.reports).toEqual([])
    expect(result.current.reportOps).toEqual([])
    expect(result.current.alerts).toEqual([])
    expect(result.current.responders).toEqual([])
  })

  it('flushes prior tenant data when claims flip back to authLoading', () => {
    let reportsCallback: ((snap: { docs: { id: string; data: () => unknown }[] }) => void) | null =
      null
    mockOnSnapshot.mockImplementation((ref: unknown, next: unknown) => {
      const r = ref as { kind?: string }
      if (r.kind === 'query' && !reportsCallback) {
        reportsCallback = next as typeof reportsCallback
      }
      return mockUnsubscribe
    })

    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const { result, rerender } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    act(() => {
      reportsCallback?.({
        docs: [
          {
            id: 'r-m001',
            data: () => ({
              type: 'flood',
              severity: 'high',
              municipality: 'X',
              barangay: 'Y',
              createdAt: '00:00',
              status: 'new',
              description: 'd',
            }),
          },
        ],
      })
    })

    expect(result.current.reports).toHaveLength(1)

    useAuthMock.mockReturnValue({
      user: null,
      claims: null,
      loading: true,
    })

    act(() => {
      rerender()
    })

    expect(result.current.reports).toEqual([])
    expect(result.current.reportOps).toEqual([])
    expect(result.current.alerts).toEqual([])
    expect(result.current.responders).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('clears stale onSnapshot error when claims flip back to authLoading', () => {
    // Capture the FIRST error handler we see so we can simulate a listener
    // failure on the prior scope before the token refresh.
    let firstErrorHandler: ((err: Error) => void) | null = null
    mockOnSnapshot.mockImplementation((_ref: unknown, _next: unknown, error: unknown) => {
      if (!firstErrorHandler && typeof error === 'function') {
        firstErrorHandler = error as (err: Error) => void
      }
      return mockUnsubscribe
    })

    useAuthMock.mockReturnValue({
      user: { uid: 'muni-1' },
      claims: { role: 'municipal_admin', municipalityId: 'M001' },
      loading: false,
    })

    const { result, rerender } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    // Force the listener into an error state on the M001 scope.
    act(() => {
      firstErrorHandler?.(new Error('permission-denied'))
    })
    expect(result.current.error).toBe('permission-denied')

    // Token refresh: claims briefly null + loading=true. The authLoading
    // branch must clear the stale error before flipping back to loading,
    // otherwise the UI would render a failure banner over the spinner.
    useAuthMock.mockReturnValue({
      user: null,
      claims: null,
      loading: true,
    })

    act(() => {
      rerender()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(true)
  })
})
