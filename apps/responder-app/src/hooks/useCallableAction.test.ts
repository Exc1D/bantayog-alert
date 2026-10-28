import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockAwaitToken = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ auth: {} }))
vi.mock('../app/await-auth-token', () => ({ awaitFreshAuthToken: mockAwaitToken }))

import { useCallableAction } from './useCallableAction'

describe('useCallableAction', () => {
  it('rejects with auth_required and sets error when signed out', async () => {
    mockAwaitToken.mockResolvedValueOnce(null)
    const action = vi.fn()
    const { result } = renderHook(() => useCallableAction('test', 'disp-1'))

    await act(async () => {
      await expect(result.current.run(action)).rejects.toThrow('auth_required')
    })

    expect(action).not.toHaveBeenCalled()
    expect(result.current.error?.message).toBe('auth_required')
    expect(result.current.loading).toBe(false)
  })

  it('reuses the idempotency key across retries and rotates it when the scope changes', async () => {
    mockAwaitToken.mockResolvedValue({ uid: 'uid-1' })
    const keys: string[] = []
    const action = vi.fn(({ idempotencyKey }: { idempotencyKey: string }) => {
      keys.push(idempotencyKey)
      return Promise.resolve()
    })
    const { result, rerender } = renderHook(({ id }) => useCallableAction('test', id), {
      initialProps: { id: 'disp-1' },
    })

    await act(() => result.current.run(action))
    await act(() => result.current.run(action))
    rerender({ id: 'disp-2' })
    await act(() => result.current.run(action))

    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[0])
  })
})
