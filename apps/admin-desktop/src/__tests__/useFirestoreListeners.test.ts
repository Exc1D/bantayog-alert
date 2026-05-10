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
    expect(mockOnSnapshot).toHaveBeenCalled()
  })

  it('sets up map listeners on mount', () => {
    renderHook(() => useFirestoreListeners({ windowType: 'map', db: mockDb, rtdb: mockRtdb }))
    expect(mockOnSnapshot).toHaveBeenCalled()
    expect(mockOnValue).toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
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
