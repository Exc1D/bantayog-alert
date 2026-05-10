import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockOnValue = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockCollection = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockRef = vi.hoisted(() => vi.fn().mockReturnValue({}))

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  onSnapshot: mockOnSnapshot,
}))

vi.mock('firebase/database', () => ({
  ref: mockRef,
  onValue: mockOnValue,
}))

import { useFirestoreListeners, isReportOpsDoc } from '../hooks/useFirestoreListeners'

const mockDb = {} as never
const mockRtdb = {} as never

describe('useFirestoreListeners error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSnapshot.mockReturnValue(mockUnsubscribe)
    vi.useRealTimers()
  })

  it('sets error state when onSnapshot fails', () => {
    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      if (onError) {
        onError(new Error('permission denied'))
      }
      return mockUnsubscribe
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    expect(result.current.error).toBe('permission denied')
  })

  it('retries up to MAX_RETRIES on error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let effectRunCount = 0
    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      effectRunCount++
      if (onError) {
        onError(new Error('network error'))
      }
      return mockUnsubscribe
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    // Initial mount: 3 onSnapshot calls (reports, report_ops, alerts)
    expect(effectRunCount).toBe(3)
    expect(result.current.error).toBe('network error')

    // First retry: flush timer + React state update
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(effectRunCount).toBe(6)

    // Second retry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(effectRunCount).toBe(9)

    // Third retry
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(effectRunCount).toBe(12)

    // Should stop retrying after MAX_RETRIES (3)
    const finalCount = effectRunCount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(effectRunCount).toBe(finalCount)

    vi.useRealTimers()
  })

  it('unsubscribes RTDB listener on unmount', () => {
    const { unmount } = renderHook(() =>
      useFirestoreListeners({ windowType: 'map', db: mockDb, rtdb: mockRtdb }),
    )

    unmount()
    // Map: 3 onSnapshot + 1 onValue = 4 unsubscribes
    expect(mockUnsubscribe).toHaveBeenCalledTimes(4)
  })

  it('clears retry timer on unmount', async () => {
    vi.useFakeTimers()
    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      if (onError) {
        onError(new Error('transient'))
      }
      return mockUnsubscribe
    })

    const { unmount } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    // Trigger error to schedule retry
    await vi.advanceTimersByTimeAsync(0)

    unmount()

    // After unmount, advancing timers should not cause new onSnapshot calls
    const callCountAfterUnmount = mockOnSnapshot.mock.calls.length
    await vi.advanceTimersByTimeAsync(500)
    expect(mockOnSnapshot.mock.calls.length).toBe(callCountAfterUnmount)

    vi.useRealTimers()
  })

  it('filters malformed reportOps docs', async () => {
    const reportOpsCol = { _name: 'report_ops' }
    const reportsCol = { _name: 'reports' }
    const alertsCol = { _name: 'alerts' }

    mockCollection.mockImplementation((_db, name) => {
      if (name === 'report_ops') return reportOpsCol
      if (name === 'reports') return reportsCol
      if (name === 'alerts') return alertsCol
      return {}
    })

    mockOnSnapshot.mockImplementation((colRef, callback) => {
      if (colRef === reportOpsCol) {
        callback({
          docs: [
            { id: 'op1', data: () => ({ reportId: 'r1', status: 'pending' }) },
            { id: 'op2', data: () => ({ status: 'pending' }) }, // missing reportId
            { id: 'op3', data: () => ({ reportId: 'r3' }) },
          ],
        })
      } else {
        callback({ docs: [] })
      }
      return mockUnsubscribe
    })

    const { result } = renderHook(() =>
      useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }),
    )

    await waitFor(() => {
      expect(result.current.reportOps).toHaveLength(2)
      expect(result.current.reportOps[0]).toMatchObject({ id: 'op1', reportId: 'r1' })
      expect(result.current.reportOps[1]).toMatchObject({ id: 'op3', reportId: 'r3' })
    })
  })
})

describe('isReportOpsDoc', () => {
  it('returns true for valid docs', () => {
    expect(isReportOpsDoc({ id: 'a', reportId: 'b' })).toBe(true)
    expect(isReportOpsDoc({ id: 'a', reportId: 'b', acknowledgedAt: 't', status: 's' })).toBe(true)
  })

  it('returns false for invalid docs', () => {
    expect(isReportOpsDoc(null)).toBe(false)
    expect(isReportOpsDoc(undefined)).toBe(false)
    expect(isReportOpsDoc({ id: 'a' })).toBe(false)
    expect(isReportOpsDoc({ reportId: 'b' })).toBe(false)
    expect(isReportOpsDoc({})).toBe(false)
    expect(isReportOpsDoc('string')).toBe(false)
  })
})
