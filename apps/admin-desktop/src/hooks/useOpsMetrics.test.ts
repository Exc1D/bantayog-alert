import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const mockGetOpsMetrics = vi.hoisted(() => vi.fn())

vi.mock('../services/callables', () => ({
  callables: {
    getOpsMetrics: mockGetOpsMetrics,
  },
}))

import { useOpsMetrics } from './useOpsMetrics'

describe('useOpsMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches metrics on mount', async () => {
    mockGetOpsMetrics.mockResolvedValue({
      metrics: {
        avgAcceptSeconds: 42,
        fcmSuccessRate: 0.95,
        totalDispatches: 100,
        acceptedCount: 80,
        declinedCount: 10,
        escalatedCount: 5,
        needsAdminCount: 5,
      },
    })

    const { result } = renderHook(() => useOpsMetrics('24h'))

    expect(result.current.loading).toBe(true)
    expect(result.current.metrics).toBeNull()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.metrics).toEqual({
      avgAcceptSeconds: 42,
      fcmSuccessRate: 0.95,
      totalDispatches: 100,
      acceptedCount: 80,
      declinedCount: 10,
      escalatedCount: 5,
      needsAdminCount: 5,
    })
  })

  it('sets error on fetch failure', async () => {
    mockGetOpsMetrics.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useOpsMetrics('24h'))

    await waitFor(() => {
      expect(result.current.error).toBe('network error')
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.metrics).toBeNull()
  })

  it('polls every 60 seconds', async () => {
    vi.useFakeTimers()
    mockGetOpsMetrics.mockResolvedValue({
      metrics: {
        avgAcceptSeconds: 42,
        fcmSuccessRate: 0.95,
        totalDispatches: 100,
        acceptedCount: 80,
        declinedCount: 10,
        escalatedCount: 5,
        needsAdminCount: 5,
      },
    })

    renderHook(() => useOpsMetrics('24h'))

    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetOpsMetrics).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })

    expect(mockGetOpsMetrics).toHaveBeenCalledTimes(2)
  })

  it('passes timeRange to callable', async () => {
    mockGetOpsMetrics.mockResolvedValue({
      metrics: {
        avgAcceptSeconds: null,
        fcmSuccessRate: 0,
        totalDispatches: 0,
        acceptedCount: 0,
        declinedCount: 0,
        escalatedCount: 0,
        needsAdminCount: 0,
      },
    })

    renderHook(() => useOpsMetrics('7d'))

    await waitFor(() => {
      expect(mockGetOpsMetrics).toHaveBeenCalledWith({ timeRange: '7d' })
    })
  })

  it('stops polling on unmount', async () => {
    vi.useFakeTimers()
    mockGetOpsMetrics.mockResolvedValue({
      metrics: {
        avgAcceptSeconds: 42,
        fcmSuccessRate: 0.95,
        totalDispatches: 100,
        acceptedCount: 80,
        declinedCount: 10,
        escalatedCount: 5,
        needsAdminCount: 5,
      },
    })

    const { unmount } = renderHook(() => useOpsMetrics('24h'))

    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetOpsMetrics).toHaveBeenCalledTimes(1)

    unmount()

    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })

    expect(mockGetOpsMetrics).toHaveBeenCalledTimes(1)
  })

  it('handles null avgAcceptSeconds', async () => {
    mockGetOpsMetrics.mockResolvedValue({
      metrics: {
        avgAcceptSeconds: null,
        fcmSuccessRate: 0,
        totalDispatches: 0,
        acceptedCount: 0,
        declinedCount: 0,
        escalatedCount: 0,
        needsAdminCount: 0,
      },
    })

    const { result } = renderHook(() => useOpsMetrics('24h'))

    await waitFor(() => {
      expect(result.current.metrics?.avgAcceptSeconds).toBeNull()
    })
  })
})
