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

import { useAdvanceDispatch } from './useAdvanceDispatch'

describe('useAdvanceDispatch', () => {
  beforeEach(() => {
    mockHttpsCallable.mockClear()
    mockCallable.mockClear()
  })

  it('calls the callable with correct payload including idempotency key', async () => {
    mockCallable.mockResolvedValue({ data: { status: 'acknowledged' } })
    const { result } = renderHook(() => useAdvanceDispatch('disp-1'))

    await act(async () => {
      await result.current.advance('acknowledged')
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'advanceDispatch')
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: 'disp-1',
        to: 'acknowledged',
        idempotencyKey: expect.any(String),
      }),
    )
    expect(mockCallable.mock.calls[0]?.[0]).not.toHaveProperty('resolutionSummary')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
  })

  it('includes resolutionSummary when advancing to resolved', async () => {
    mockCallable.mockResolvedValue({ data: { status: 'resolved' } })
    const { result } = renderHook(() => useAdvanceDispatch('disp-1'))

    await act(async () => {
      await result.current.advance('resolved', { resolutionSummary: 'Fire contained' })
    })

    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'resolved',
        resolutionSummary: 'Fire contained',
      }),
    )
  })

  it('throws if resolutionSummary is missing for resolved target', async () => {
    const { result } = renderHook(() => useAdvanceDispatch('disp-1'))

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.advance('resolved')
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('resolutionSummary_required')
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('resolutionSummary_required')
    expect(result.current.loading).toBe(false)
  })

  it('sets error and re-throws on failure', async () => {
    mockCallable.mockRejectedValue(new Error('invalid_transition'))
    const { result } = renderHook(() => useAdvanceDispatch('disp-1'))

    let thrown: Error | undefined
    await act(async () => {
      try {
        await result.current.advance('en_route')
      } catch (err) {
        thrown = err as Error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown?.message).toBe('invalid_transition')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('invalid_transition')
  })

  it('rotates idempotency key after a successful call', async () => {
    mockCallable.mockResolvedValue({ data: { status: 'acknowledged' } })
    const { result } = renderHook(() => useAdvanceDispatch('disp-1'))

    await act(async () => {
      await result.current.advance('acknowledged')
    })
    const call0 = mockCallable.mock.calls[0]!
    const firstKey = (call0[0] as { idempotencyKey: string }).idempotencyKey

    await act(async () => {
      await result.current.advance('en_route')
    })
    const call1 = mockCallable.mock.calls[1]!
    const secondKey = (call1[0] as { idempotencyKey: string }).idempotencyKey

    expect(firstKey).not.toBe(secondKey)
  })

  it('reuses the same idempotency key when retrying the same transition', async () => {
    mockCallable.mockRejectedValueOnce(new Error('network error'))
    mockCallable.mockResolvedValueOnce({ data: { status: 'acknowledged' } })
    const { result } = renderHook(() => useAdvanceDispatch('disp-1'))

    await act(async () => {
      try {
        await result.current.advance('acknowledged')
      } catch {
        /* expected to fail first time */
      }
    })
    const call0 = mockCallable.mock.calls[0]!
    const firstKey = (call0[0] as { idempotencyKey: string }).idempotencyKey

    await act(async () => {
      await result.current.advance('acknowledged')
    })
    const call1 = mockCallable.mock.calls[1]!
    const secondKey = (call1[0] as { idempotencyKey: string }).idempotencyKey

    expect(firstKey).toBe(secondKey)
  })
})
