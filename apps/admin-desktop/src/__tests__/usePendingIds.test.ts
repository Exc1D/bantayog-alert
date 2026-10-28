import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePendingIds } from '../hooks/usePendingIds'

describe('usePendingIds', () => {
  it('marks the id pending while the action runs and clears it after', async () => {
    const { result } = renderHook(() => usePendingIds())
    let release!: () => void
    let done!: Promise<string>
    act(() => {
      done = result.current[1](
        'r1',
        () =>
          new Promise<string>(
            (r) =>
              (release = () => {
                r('ok')
              }),
          ),
      )
    })
    expect(result.current[0].has('r1')).toBe(true)
    await act(async () => {
      release()
      await expect(done).resolves.toBe('ok')
    })
    expect(result.current[0].has('r1')).toBe(false)
  })

  it('clears the id and rethrows when the action fails', async () => {
    const { result } = renderHook(() => usePendingIds())
    await act(async () => {
      await expect(
        result.current[1]('r1', () => Promise.reject(new Error('boom'))),
      ).rejects.toThrow('boom')
    })
    expect(result.current[0].size).toBe(0)
  })
})
