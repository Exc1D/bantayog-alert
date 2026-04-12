/**
 * Alert Service Tests
 *
 * Tests Firestore alert queries (one-shot fetches, real-time subscriptions, pagination).
 * Uses vi.hoisted() for stable mock references per the firebase test mock pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAlerts,
  getAlertsByMunicipality,
  subscribeToAlerts,
  subscribeToAlertsByMunicipality,
  getAlertsPage,
  type AlertFilters,
} from '../alert.service'
import type { Alert } from '@/shared/types/firestore.types'

// Mock firebase/firestore — must be stable references via vi.hoisted()
const getDocsMock = vi.hoisted(() => vi.fn())
const onSnapshotMock = vi.hoisted(() => vi.fn())
const queryMock = vi.hoisted(() => vi.fn())
const collectionMock = vi.hoisted(() => vi.fn())
const whereMock = vi.hoisted(() => vi.fn())
const orderByMock = vi.hoisted(() => vi.fn())
const limitMock = vi.hoisted(() => vi.fn())
const startAfterMock = vi.hoisted(() => vi.fn())

vi.mock('firebase/firestore', () => ({
  collection: collectionMock,
  query: queryMock,
  where: whereMock,
  orderBy: orderByMock,
  limit: limitMock,
  startAfter: startAfterMock,
  getDocs: getDocsMock,
  onSnapshot: onSnapshotMock,
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
}))

// Factory for mock alert documents as Firestore would return them
function mockAlertDoc(overrides: Partial<Alert> = {}): Alert & { _id?: string } {
  return {
    id: 'alert-1',
    createdAt: Date.now(),
    targetAudience: 'all',
    title: 'Test Alert',
    message: 'This is a test alert',
    severity: 'info',
    deliveryMethod: ['in_app'],
    createdBy: 'admin-uid',
    isActive: true,
    ...overrides,
  }
}

// Helper to track how many times where was called with which field/operator/value
type WhereCall = { field: string; op: string; value: unknown }
const whereCalls: WhereCall[] = []

beforeEach(() => {
  whereCalls.length = 0
  vi.clearAllMocks()
})

// Smart mock: tracks where() calls and filters docs accordingly
function mockGetDocs(alerts: Alert[]) {
  getDocsMock.mockImplementation(() => {
    return Promise.resolve({
      docs: alerts.map((a) => ({
        id: a.id,
        data: () => a,
      })),
    })
  })
}

function mockWhere(field: string, _op: string, value: unknown) {
  whereCalls.push({ field, op: _op, value })
  return `mock-constraint-${field}`
}

function mockGetDocsFiltered(allAlerts: Alert[]) {
  getDocsMock.mockImplementation(() => {
    let filtered = [...allAlerts]

    for (const call of whereCalls) {
      if (call.field === 'isActive') {
        filtered = filtered.filter((a) => a.isActive === call.value)
      }
      if (call.field === 'severity') {
        filtered = filtered.filter((a) => a.severity === call.value)
      }
    }

    return Promise.resolve({
      docs: filtered.map((a) => ({
        id: a.id,
        data: () => a,
      })),
    })
  })
}

function mockQuerySnap(alerts: Alert[]): { docs: Array<{ id: string; data: () => Alert }> } {
  return {
    docs: alerts.map((a) => ({
      id: a.id,
      data: () => a,
    })),
  }
}

describe('getAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    whereMock.mockImplementation(mockWhere)
  })

  it('should fetch alerts with isActive: true filter by default', async () => {
    const allAlerts = [
      mockAlertDoc({ id: 'alert-active', isActive: true }),
      mockAlertDoc({ id: 'alert-inactive', isActive: false }),
    ]
    // Smart mock: filters by isActive based on where() calls
    mockGetDocsFiltered(allAlerts)

    const result = await getAlerts()

    expect(whereMock).toHaveBeenCalledWith('isActive', '==', true)
    expect(result.map((a) => a.id)).not.toContain('alert-inactive')
    expect(result.map((a) => a.id)).toContain('alert-active')
  })

  it('should filter by severity when provided', async () => {
    const allAlerts = [
      mockAlertDoc({ id: 'alert-critical', severity: 'emergency' }),
      mockAlertDoc({ id: 'alert-warning', severity: 'warning' }),
    ]
    mockGetDocsFiltered(allAlerts)

    const result = await getAlerts({ severity: 'emergency' })

    expect(whereMock).toHaveBeenCalledWith('severity', '==', 'emergency')
    expect(result.map((a) => a.id)).toContain('alert-critical')
    expect(result.map((a) => a.id)).not.toContain('alert-warning')
  })

  it('should filter expired alerts client-side', async () => {
    const now = Date.now()
    const alerts = [
      mockAlertDoc({ id: 'alert-valid', expiresAt: now + 86400000 }),
      mockAlertDoc({ id: 'alert-expired', expiresAt: now - 86400000 }),
    ]
    mockGetDocs(alerts)

    const result = await getAlerts()

    expect(result.map((a) => a.id)).not.toContain('alert-expired')
    expect(result.map((a) => a.id)).toContain('alert-valid')
  })

  it('should include alerts with no expiresAt (never expire)', async () => {
    const alerts = [
      mockAlertDoc({ id: 'alert-no-expiry', expiresAt: undefined }),
      mockAlertDoc({ id: 'alert-expired', expiresAt: Date.now() - 1000 }),
    ]
    mockGetDocs(alerts)

    const result = await getAlerts()

    expect(result.map((a) => a.id)).toContain('alert-no-expiry')
    expect(result.map((a) => a.id)).not.toContain('alert-expired')
  })
})

describe('getAlertsByMunicipality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use array-contains filter for municipality', async () => {
    const alerts = [mockAlertDoc({ id: 'alert-daet' })]
    getDocsMock.mockResolvedValue(mockQuerySnap(alerts))

    await getAlertsByMunicipality('daet')

    expect(whereMock).toHaveBeenCalledWith(
      'affectedAreas.municipalities',
      'array-contains',
      'daet'
    )
  })

  it('should return empty array when no alerts match', async () => {
    getDocsMock.mockResolvedValue({ docs: [] })

    const result = await getAlertsByMunicipality('nonexistent')

    expect(result).toEqual([])
  })

  it('should filter expired alerts client-side', async () => {
    const now = Date.now()
    const alerts = [
      mockAlertDoc({ id: 'alert-valid', expiresAt: now + 86400000 }),
      mockAlertDoc({ id: 'alert-expired', expiresAt: now - 86400000 }),
    ]
    getDocsMock.mockResolvedValue(mockQuerySnap(alerts))

    const result = await getAlertsByMunicipality('daet')

    expect(result.map((a) => a.id)).not.toContain('alert-expired')
  })
})

describe('subscribeToAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call onSnapshot and return unsubscribe function', () => {
    const unsubscribe = vi.fn()
    onSnapshotMock.mockReturnValue(unsubscribe)

    const result = subscribeToAlerts({}, vi.fn())

    expect(onSnapshotMock).toHaveBeenCalled()
    expect(result).toBeDefined()
    expect(typeof result).toBe('function')
  })

  it('should call callback with alerts array on snapshot', () => {
    const callback = vi.fn()
    const alerts = [mockAlertDoc({ id: 'alert-1' }), mockAlertDoc({ id: 'alert-2' })]
    onSnapshotMock.mockImplementation((_query, onNext) => {
      onNext({
        docs: alerts.map((a) => ({
          id: a.id,
          data: () => a,
        })),
      })
      return vi.fn()
    })

    subscribeToAlerts({}, callback)

    expect(callback).toHaveBeenCalled()
    const calledWith = callback.mock.calls[0][0] as Alert[]
    expect(calledWith).toHaveLength(2)
    expect(calledWith[0].id).toBe('alert-1')
  })

  it('should call error callback on snapshot error', () => {
    const callback = vi.fn()
    const errorCallback = vi.fn()
    const testError = new Error('Firestore unavailable')

    onSnapshotMock.mockImplementation((_query, onNext, onError) => {
      onError(testError)
      return vi.fn()
    })

    subscribeToAlerts({}, callback, errorCallback)

    expect(errorCallback).toHaveBeenCalledWith(testError)
  })

  it('should filter expired alerts on each snapshot update', () => {
    const callback = vi.fn()
    const now = Date.now()
    const alerts = [
      mockAlertDoc({ id: 'alert-valid', expiresAt: now + 86400000 }),
      mockAlertDoc({ id: 'alert-expired', expiresAt: now - 86400000 }),
    ]

    onSnapshotMock.mockImplementation((_query, onNext) => {
      onNext({
        docs: alerts.map((a) => ({ id: a.id, data: () => a })),
      })
      return vi.fn()
    })

    subscribeToAlerts({}, callback)

    const calledWith = callback.mock.calls[0][0] as Alert[]
    expect(calledWith.map((a) => a.id)).not.toContain('alert-expired')
    expect(calledWith.map((a) => a.id)).toContain('alert-valid')
  })
})

describe('subscribeToAlertsByMunicipality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return unsubscribe that stops listening', () => {
    const unsubscribe = vi.fn()
    onSnapshotMock.mockReturnValue(unsubscribe)

    const result = subscribeToAlertsByMunicipality('daet', vi.fn())

    expect(result).toBe(unsubscribe)
  })

  it('should use affectedAreas.municipalities array-contains in query', () => {
    onSnapshotMock.mockReturnValue(vi.fn())

    subscribeToAlertsByMunicipality('daet', vi.fn())

    expect(whereMock).toHaveBeenCalledWith(
      'affectedAreas.municipalities',
      'array-contains',
      'daet'
    )
  })
})

describe('getAlertsPage', () => {
  beforeEach(() => {
    // Reset implementations and call history specifically for the mocks we use
    getDocsMock.mockReset()
    startAfterMock.mockReset()
    startAfterMock.mockReturnValue('mock-cursor')
  })

  it('should return alerts and nextCursor when more results exist', async () => {
    const mockLastDoc = {} as never
    getDocsMock.mockResolvedValue({
      docs: [
        { id: 'alert-1', data: () => mockAlertDoc({ id: 'alert-1' }) },
        { id: 'alert-last', data: () => mockAlertDoc({ id: 'alert-last' }) },
      ],
    })
    startAfterMock.mockReturnValue('mock-cursor')

    const result = await getAlertsPage(mockLastDoc)

    expect(result.alerts).toHaveLength(2)
    expect(result.nextCursor).toBeDefined()
  })

  it('should return null nextCursor when no more results', async () => {
    getDocsMock.mockResolvedValue({
      docs: [{ id: 'alert-1', data: () => mockAlertDoc({ id: 'alert-1' }) }],
    })

    const result = await getAlertsPage()

    expect(result.alerts).toHaveLength(1)
    expect(result.nextCursor).toBeNull()
  })

  it('should filter expired alerts client-side', async () => {
    const now = Date.now()
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: 'alert-valid',
          data: () => mockAlertDoc({ id: 'alert-valid', expiresAt: now + 86400000 }),
        },
        {
          id: 'alert-expired',
          data: () => mockAlertDoc({ id: 'alert-expired', expiresAt: now - 86400000 }),
        },
      ],
    })

    const result = await getAlertsPage()

    expect(result.alerts.map((a) => a.id)).not.toContain('alert-expired')
  })
})
