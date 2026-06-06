import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimisticFeedActions } from '../hooks/useOptimisticFeedActions'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useOptimisticFeedActions', () => {
  it('immediately updates local state before backend resolves', async () => {
    const backendDone = createDeferred<undefined>()
    const verifyBackend = vi.fn(() => backendDone.promise)
    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useOptimisticFeedActions({
        reports: [{ id: 'r1', status: 'awaiting_verify' as const }],
        verifyReport: verifyBackend,
        onSuccess,
      }),
    )

    let actionPromise: Promise<void> | undefined
    act(() => {
      actionPromise = result.current.optimisticVerify('r1')
    })

    // Status should immediately change to 'verified'
    expect(result.current.optimisticReports.find((r) => r.id === 'r1')?.status).toBe('verified')

    // Backend should have been called
    expect(verifyBackend).toHaveBeenCalledWith('r1')

    await act(async () => {
      backendDone.resolve(undefined)
      await actionPromise
    })
  })

  it('rolls back on backend failure', async () => {
    const verifyBackend = vi.fn().mockRejectedValue(new Error('Network failed'))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useOptimisticFeedActions({
        reports: [{ id: 'r1', status: 'awaiting_verify' as const }],
        verifyReport: verifyBackend,
        onError,
      }),
    )

    act(() => {
      void result.current.optimisticVerify('r1')
    })

    // Should roll back after rejection
    await waitFor(() => {
      expect(result.current.optimisticReports.find((r) => r.id === 'r1')?.status).toBe(
        'awaiting_verify',
      )
    })

    expect(onError).toHaveBeenCalledWith('r1', expect.any(Error))
  })

  it('tracks which items are pending', async () => {
    const verifyBackend = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 100)))

    const { result } = renderHook(() =>
      useOptimisticFeedActions({
        reports: [{ id: 'r1', status: 'awaiting_verify' as const }],
        verifyReport: verifyBackend,
      }),
    )

    act(() => {
      void result.current.optimisticVerify('r1')
    })

    expect(result.current.pendingIds.has('r1')).toBe(true)

    await waitFor(() => {
      expect(result.current.pendingIds.has('r1')).toBe(false)
    })
  })

  describe('optimisticUnpublish', () => {
    it('immediately updates local state before backend resolves', async () => {
      const backendDone = createDeferred<undefined>()
      const unpublishBackend = vi.fn(() => backendDone.promise)
      const onSuccess = vi.fn()

      const { result } = renderHook(() =>
        useOptimisticFeedActions({
          reports: [{ id: 'r1', status: 'public_alertable' as const }],
          unpublishReport: unpublishBackend,
          onSuccess,
        }),
      )

      let actionPromise: Promise<void> | undefined
      act(() => {
        actionPromise = result.current.optimisticUnpublish('r1')
      })

      // Status should immediately change to 'verified'
      expect(result.current.optimisticReports.find((r) => r.id === 'r1')?.status).toBe('verified')
      expect(unpublishBackend).toHaveBeenCalledWith('r1')

      await act(async () => {
        backendDone.resolve(undefined)
        await actionPromise
      })
    })

    it('rolls back on backend failure', async () => {
      const unpublishBackend = vi.fn().mockRejectedValue(new Error('Permission denied'))
      const onError = vi.fn()

      const { result } = renderHook(() =>
        useOptimisticFeedActions({
          reports: [{ id: 'r1', status: 'public_alertable' as const }],
          unpublishReport: unpublishBackend,
          onError,
        }),
      )

      act(() => {
        void result.current.optimisticUnpublish('r1')
      })

      await waitFor(() => {
        expect(result.current.optimisticReports.find((r) => r.id === 'r1')?.status).toBe(
          'public_alertable',
        )
      })

      expect(onError).toHaveBeenCalledWith('r1', expect.any(Error))
    })

    it('tracks pending state', async () => {
      const unpublishBackend = vi.fn(() => new Promise((resolve) => setTimeout(resolve, 50)))

      const { result } = renderHook(() =>
        useOptimisticFeedActions({
          reports: [{ id: 'r1', status: 'public_alertable' as const }],
          unpublishReport: unpublishBackend,
        }),
      )

      act(() => {
        void result.current.optimisticUnpublish('r1')
      })

      expect(result.current.pendingIds.has('r1')).toBe(true)

      await waitFor(() => {
        expect(result.current.pendingIds.has('r1')).toBe(false)
      })
    })
  })
})
