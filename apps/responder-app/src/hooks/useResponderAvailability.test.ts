import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockSetDoc = vi.hoisted(() => vi.fn())
const mockOnSnapshot = vi.hoisted(() => vi.fn())
const mockDoc = vi.hoisted(() => vi.fn(() => ({ path: 'responders/uid-1' })))

vi.mock('../app/firebase', () => ({
  db: {},
}))
vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  deleteField: () => ({ _type: 'deleteField' }),
}))

import { useResponderAvailability } from './useResponderAvailability'

describe('useResponderAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped status from Firestore snapshot', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        data: () => ({ availabilityStatus: 'on_duty' }),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useResponderAvailability('uid-1'))

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets writeError when setDoc fails', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        data: () => ({ availabilityStatus: 'available' }),
      })
      return vi.fn()
    })
    mockSetDoc.mockRejectedValue(new Error('permission_denied'))

    const { result } = renderHook(() => useResponderAvailability('uid-1'))

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.setAvailability('unavailable', 'On break')
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('permission_denied')
    expect(result.current.writeError).toBe('permission_denied')
  })

  it('throws when reason is missing for non-available status', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        data: () => ({ availabilityStatus: 'available' }),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useResponderAvailability('uid-1'))

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.setAvailability('unavailable', '   ')
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('reason_required')
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('clears writeError on successful write', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        data: () => ({ availabilityStatus: 'available' }),
      })
      return vi.fn()
    })
    mockSetDoc.mockRejectedValueOnce(new Error('first_fail'))
    mockSetDoc.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useResponderAvailability('uid-1'))

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })

    // First call fails
    await act(async () => {
      try {
        await result.current.setAvailability('off_duty', 'Shift ended')
      } catch {
        /* expected */
      }
    })
    expect(result.current.writeError).toBe('first_fail')

    // Second call succeeds — writeError should be cleared
    await act(async () => {
      await result.current.setAvailability('available')
    })
    expect(result.current.writeError).toBeNull()
  })
})
