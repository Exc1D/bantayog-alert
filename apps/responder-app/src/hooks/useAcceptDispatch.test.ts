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

import { useAcceptDispatch } from './useAcceptDispatch'

describe('useAcceptDispatch', () => {
  beforeEach(() => {
    mockHttpsCallable.mockClear()
    mockCallable.mockClear()
  })

  it('calls the callable with correct payload including idempotency key', async () => {
    mockCallable.mockResolvedValue({ data: { status: 'accepted' } })
    const { result } = renderHook(() => useAcceptDispatch('disp-1'))

    await act(async () => {
      await result.current.accept()
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'acceptDispatch')
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 'disp-1',
        idempotencyKey: expect.any(String),
      }),
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it('sets error and re-throws on failure', async () => {
    mockCallable.mockRejectedValue(new Error('already_claimed'))
    const { result } = renderHook(() => useAcceptDispatch('disp-1'))

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.accept()
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('already_claimed')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('already_claimed')
  })
})
