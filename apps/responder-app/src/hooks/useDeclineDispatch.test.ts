import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockCallable = vi.hoisted(() => vi.fn())
const mockHttpsCallable = vi.hoisted(() => vi.fn(() => mockCallable))

vi.mock('../app/firebase', () => ({
  auth: {},
  functions: {},
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}))
vi.mock('../app/await-auth-token', () => ({
  awaitFreshAuthToken: () => Promise.resolve({ uid: 'uid-1' }),
}))

import { useDeclineDispatch } from './useDeclineDispatch'

describe('useDeclineDispatch', () => {
  beforeEach(() => {
    mockHttpsCallable.mockClear()
    mockCallable.mockClear()
  })

  it('calls the callable with correct payload including idempotency key', async () => {
    mockCallable.mockResolvedValue({ data: { status: 'declined' } })
    const { result } = renderHook(() => useDeclineDispatch('disp-1'))

    await act(async () => {
      await result.current.decline('Already on another call')
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'declineDispatch')
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 'disp-1',
        declineReason: 'Already on another call',
        idempotencyKey: expect.any(String),
      }),
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it('throws if decline reason is empty', async () => {
    const { result } = renderHook(() => useDeclineDispatch('disp-1'))

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.decline('   ')
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('declineReason_required')
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('declineReason_required')
  })

  it('sets error and re-throws on failure', async () => {
    mockCallable.mockRejectedValue(new Error('dispatch_expired'))
    const { result } = renderHook(() => useDeclineDispatch('disp-1'))

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.decline('Too far away')
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('dispatch_expired')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('dispatch_expired')
  })
})
