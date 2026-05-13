import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockOnValue = vi.hoisted(() => vi.fn().mockReturnValue(mockUnsubscribe))
const mockCollection = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockQuery = vi.hoisted(() => vi.fn().mockImplementation((ref) => ref))
const mockWhere = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockRef = vi.hoisted(() => vi.fn().mockReturnValue({}))
const useAuthMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    user: { uid: 'super-1' },
    claims: { role: 'provincial_superadmin' },
    loading: false,
  }),
)

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
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
    vi.useFakeTimers()
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

    // Initial mount: 3 onSnapshot calls (reports, report_ops, alerts).
    expect(effectRunCount).toBe(3)
    expect(result.current.error).toBe('network error')

    // Drain every retry cycle. The shared scheduleRetry() helper keeps exactly
    // ONE timer pending per cycle (clears the prior before re-arming). Each
    // act() boundary forces React to commit the setRetryCount update and run
    // the effect — which arms the next cycle's timer — before the loop drains
    // it. Without the per-iteration act(), runAllTimersAsync inside a single
    // act() fires only the FIRST pending timer; the effect re-run is queued
    // but never runs because no further reconciliation pass happens inside the
    // same act().
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await vi.runAllTimersAsync()
      })
    }

    // Deterministic post-fix: 4 effect runs (initial + 3 retries) × 3 listeners
    // = 12. After retryCount === MAX_RETRIES the scheduler is a no-op, so
    // further timer ticks add nothing.
    expect(effectRunCount).toBe(12)

    vi.useRealTimers()
  })

  it('resets retry budget after a successful connection', async () => {
    // Regression: without resetRetryBudget(), once retryCount reaches
    // MAX_RETRIES the scheduler is permanently disabled. A listener that
    // recovers and then fails again would never retry. Verify the success
    // callback restores the budget by exhausting retries, firing a success,
    // and confirming a follow-up error triggers a fresh retry cycle.
    vi.useFakeTimers()
    let effectRunCount = 0
    type NextHandler = (snapshot: { docs: unknown[] }) => void
    type ErrorHandler = (err: Error) => void
    let latestNext: NextHandler | null = null
    let latestError: ErrorHandler | null = null
    mockOnSnapshot.mockImplementation((_ref, onNext, onError) => {
      effectRunCount++
      // Within a single effect run, all three listeners share the same
      // scheduleRetry/resetRetryBudget closure, so capturing the last
      // listener's handlers is sufficient.
      latestNext = onNext as NextHandler
      latestError = onError as ErrorHandler
      return mockUnsubscribe
    })

    renderHook(() => useFirestoreListeners({ windowType: 'dashboard', db: mockDb, rtdb: mockRtdb }))

    // Initial mount: 3 listeners subscribed once each.
    expect(effectRunCount).toBe(3)

    // Drive the budget to MAX_RETRIES. Each retry cycle re-subscribes all
    // three listeners → +3 per cycle. After 3 retries the budget is
    // exhausted; the 4th attempt is a no-op (scheduleRetry short-circuits),
    // so timer drain produces nothing further.
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        latestError?.(new Error('transient'))
        await vi.runAllTimersAsync()
      })
    }
    expect(effectRunCount).toBe(12)

    // Listener recovers. resetRetryBudget() inside the success callback flips
    // retryCount 3 → 0, which is a dep-array change, so the effect re-runs
    // and re-subscribes (+3).
    act(() => {
      latestNext?.({ docs: [] })
    })
    expect(effectRunCount).toBe(15)

    // After the reset, a fresh error must schedule a new retry. Without the
    // fix, scheduleRetry would still see retryCount === MAX_RETRIES and
    // short-circuit, leaving effectRunCount stuck at 15.
    await act(async () => {
      latestError?.(new Error('transient again'))
      await vi.runAllTimersAsync()
    })
    expect(effectRunCount).toBe(18)

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

    // After unmount, advancing timers past the retry boundary should not cause new onSnapshot calls
    const callCountAfterUnmount = mockOnSnapshot.mock.calls.length
    await vi.advanceTimersByTimeAsync(1500)
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
