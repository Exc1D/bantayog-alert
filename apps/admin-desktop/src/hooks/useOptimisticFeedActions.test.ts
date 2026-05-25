import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimisticFeedActions } from '../hooks/useOptimisticFeedActions'

describe('useOptimisticFeedActions', () => {
  it('immediately updates local state before backend resolves', () => {
    const verifyBackend = vi.fn().mockResolvedValue(undefined)
    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useOptimisticFeedActions({
        reports: [{ id: 'r1', status: 'awaiting_verify' as const }],
        verifyReport: verifyBackend,
        onSuccess,
      }),
    )

    act(() => {
      void result.current.optimisticVerify('r1')
    })

    // Status should immediately change to 'verified'
    expect(result.current.optimisticReports.find((r) => r.id === 'r1')?.status).toBe('verified')

    // Backend should have been called
    expect(verifyBackend).toHaveBeenCalledWith('r1')
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
    it('immediately updates local state before backend resolves', () => {
      const unpublishBackend = vi.fn().mockResolvedValue(undefined)
      const onSuccess = vi.fn()

      const { result } = renderHook(() =>
        useOptimisticFeedActions({
          reports: [{ id: 'r1', status: 'public_alertable' as const }],
          unpublishReport: unpublishBackend,
          onSuccess,
        }),
      )

      act(() => {
        void result.current.optimisticUnpublish('r1')
      })

      // Status should immediately change to 'verified'
      expect(result.current.optimisticReports.find((r) => r.id === 'r1')?.status).toBe('verified')
      expect(unpublishBackend).toHaveBeenCalledWith('r1')
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
