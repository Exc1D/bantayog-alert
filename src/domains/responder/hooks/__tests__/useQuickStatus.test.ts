/**
 * useQuickStatus Hook Tests
 *
 * Tests optimistic status update behavior with validation and rollback.
 */

import { renderHook, act } from '@testing-library/react'
import { useQuickStatus } from '../useQuickStatus'
import { runTransaction } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { canUpdateStatus } from '../../services/validation.service'

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  runTransaction: vi.fn(),
  doc: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  arrayUnion: vi.fn((x) => x),
}))

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-responder-uid' }
  })),
}))

// Mock validation service
vi.mock('../../services/validation.service', () => ({
  canUpdateStatus: vi.fn(),
}))

describe('useQuickStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update status optimistically', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    runTransaction.mockResolvedValue(undefined)

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.pendingStatus.get('dispatch-1')).toBe('en_route')
  })

  it('should handle validation errors', async () => {
    canUpdateStatus.mockResolvedValue({
      valid: false,
      code: 'NOT_ASSIGNED',
      message: 'Dispatch not assigned to you'
    })

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.error?.code).toBe('NOT_ASSIGNED')
    expect(result.current.error?.message).toBe('Dispatch not assigned to you')
  })

  it('should rollback on network error', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    runTransaction.mockRejectedValue(new Error('Network unavailable'))

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.error?.code).toBe('NETWORK_ERROR')
    expect(result.current.pendingStatus.has('dispatch-1')).toBe(false)
  })

  it('should detect stale update when dispatch no longer exists', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    const notFoundError = Object.assign(new Error('Dispatch not found'), { code: 'not-found' })
    runTransaction.mockRejectedValue(notFoundError)

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    // The error should indicate the dispatch was not found (NOT_ASSIGNED, not NETWORK_ERROR)
    expect(result.current.error?.code).toBe('NOT_ASSIGNED')
    expect(result.current.error?.isFatal).toBe(true)
    expect(result.current.pendingStatus.has('dispatch-1')).toBe(false)
  })

  it('should clear error on successful update', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    runTransaction.mockResolvedValue(undefined)

    const { result } = renderHook(() => useQuickStatus())

    // Trigger successful update
    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    // After success, error should be null
    expect(result.current.error).toBe(null)
  })

  it('should handle permission-denied error with fatal flag', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    const permissionError = Object.assign(new Error('Permission denied'), { code: 'permission-denied' })
    runTransaction.mockRejectedValue(permissionError)

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.error?.code).toBe('PERMISSION_DENIED')
    expect(result.current.error?.isFatal).toBe(true)
    expect(result.current.error?.message).toBe('Your session has expired. Please log in again.')
    expect(result.current.pendingStatus.has('dispatch-1')).toBe(false)
  })

  it('should handle unavailable/deadline-exceeded without rollback', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    const unavailableError = Object.assign(new Error('Service unavailable'), { code: 'unavailable' })
    runTransaction.mockRejectedValue(unavailableError)

    const { result } = renderHook(() => useQuickStatus())

    // First: optimistic update sets pending status
    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    // unavailable/deadline-exceeded clears pending status (does NOT keep it for later sync)
    expect(result.current.error?.code).toBe('NETWORK_ERROR')
    expect(result.current.error?.isFatal).toBe(false)
    expect(result.current.pendingStatus.has('dispatch-1')).toBe(false)
  })
})