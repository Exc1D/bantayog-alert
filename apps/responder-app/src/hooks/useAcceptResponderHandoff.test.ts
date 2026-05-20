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

import { useAcceptResponderHandoff } from './useAcceptResponderHandoff'

describe('useAcceptResponderHandoff', () => {
  beforeEach(() => {
    mockHttpsCallable.mockClear()
    mockCallable.mockClear()
  })

  it('calls the callable with handoff ID and idempotency key', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } })
    const { result } = renderHook(() => useAcceptResponderHandoff('abcdef1234567890abcd'))

    await act(async () => {
      await result.current.accept()
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'acceptResponderHandoff')
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        handoffId: 'abcdef1234567890abcd',
        idempotencyKey: expect.any(String),
      }),
    )
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it('sets error and re-throws on failure', async () => {
    mockCallable.mockRejectedValue(new Error('handoff_not_found'))
    const { result } = renderHook(() => useAcceptResponderHandoff('abcdef1234567890abcd'))

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.accept()
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('handoff_not_found')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('handoff_not_found')
  })
})
