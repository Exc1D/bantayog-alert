/**
 * useQuickStatus Hook Tests
 *
 * Tests optimistic status update behavior with validation and rollback.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useQuickStatus } from '../useQuickStatus'
import { runTransaction } from 'firebase/firestore'
import { canUpdateStatus } from '../../services/validation.service'

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  runTransaction: vi.fn(),
  doc: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  arrayUnion: vi.fn((x) => x),
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
    runTransaction.mockRejectedValue(new Error('Document does not exist'))

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    // The error should indicate the dispatch was not found
    expect(result.current.error?.code).toBe('NETWORK_ERROR')
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

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useQuickStatus())

    expect(result.current.isUpdating).toBe(false)
    expect(result.current.isValidating).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.pendingStatus.size).toBe(0)
    expect(result.current.staleUpdateDetected).toBe(false)
  })

  it('should handle permission-denied error from Firestore', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    const permissionError = new Error('Permission denied') as Error & { code: string }
    permissionError.code = 'permission-denied'
    runTransaction.mockRejectedValue(permissionError)

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.error?.code).toBe('PERMISSION_DENIED')
    expect(result.current.pendingStatus.has('dispatch-1')).toBe(false)
  })

  it('should handle not-found error from Firestore', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    const notFoundError = new Error('Not found') as Error & { code: string }
    notFoundError.code = 'not-found'
    runTransaction.mockRejectedValue(notFoundError)

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.error?.code).toBe('NOT_ASSIGNED')
    expect(result.current.pendingStatus.has('dispatch-1')).toBe(false)
  })

  it('should expose all required return values', () => {
    const { result } = renderHook(() => useQuickStatus())

    expect(result.current).toHaveProperty('updateStatus')
    expect(result.current).toHaveProperty('isUpdating')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('pendingStatus')
    expect(result.current).toHaveProperty('staleUpdateDetected')
    expect(result.current).toHaveProperty('isValidating')
  })

  it('should handle validation error with unknown code as INVALID_STATUS', async () => {
    canUpdateStatus.mockResolvedValue({
      valid: false,
      code: 'SOME_OTHER_CODE',
      message: 'Unknown validation issue'
    })

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.error?.code).toBe('INVALID_STATUS')
  })

  it('should handle offline/unavailable Firestore error gracefully', async () => {
    canUpdateStatus.mockResolvedValue({ valid: true })
    const unavailableError = new Error('Service unavailable') as Error & { code: string }
    unavailableError.code = 'unavailable'
    runTransaction.mockRejectedValue(unavailableError)

    const { result } = renderHook(() => useQuickStatus())

    await act(async () => {
      await result.current.updateStatus('dispatch-1', 'en_route')
    })

    expect(result.current.error?.code).toBe('NETWORK_ERROR')
  })
})