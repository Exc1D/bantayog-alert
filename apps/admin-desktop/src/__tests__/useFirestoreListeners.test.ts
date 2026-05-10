import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockOnValue = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockCollection = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockDoc = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockRef = vi.hoisted(() => vi.fn().mockReturnValue({}))

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
}))

vi.mock('firebase/database', () => ({
  ref: mockRef,
  onValue: mockOnValue,
}))

import { useFirestoreListeners } from '../hooks/useFirestoreListeners'

const mockDb = {} as never
const mockRtdb = {} as never

describe('useFirestoreListeners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSnapshot.mockReturnValue(mockUnsubscribe)
  })

  it('initializes with loading state', () => {
    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )
    expect(result.current.loading).toBe(true)
  })

  it('sets up dashboard listeners on mount', () => {
    renderHook(() => useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }))
    // Dashboard: reports, report_ops, alerts = 3 onSnapshot calls
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3)
  })

  it('sets up map listeners on mount', () => {
    renderHook(() => useFirestoreListeners({ windowType: 'map', db: mockDb, rtdb: mockRtdb }))
    // Map: reports, report_ops, alerts = 3 onSnapshot + 1 onValue for responder_locations
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3)
    expect(mockOnValue).toHaveBeenCalled()
  })

  it('includes reportOps and alerts in dashboard result', async () => {
    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )
    await waitFor(() => {
      expect(result.current.reportOps).toBeDefined()
      expect(result.current.alerts).toBeDefined()
    })
  })

  it('unsubscribes all listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(3)
  })

  it('updates data when snapshot arrives', async () => {
    mockOnSnapshot.mockImplementation((_ref, callback) => {
      callback({ docs: [{ id: 'r1', data: () => ({ type: 'FLOOD' }) }] })
      return mockUnsubscribe
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    await waitFor(() => {
      expect(result.current.reports.length).toBeGreaterThan(0)
    })
  })
})
