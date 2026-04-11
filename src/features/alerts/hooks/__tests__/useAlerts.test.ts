/**
 * useAlerts Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAlerts } from '../useAlerts'
import type { Alert } from '@/shared/types/firestore.types'

const mockGetCollection = vi.fn()
vi.mock('@/shared/services/firestore.service', () => ({
  getCollection: () => mockGetCollection(),
}))

const now = Date.now()

const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    createdAt: now - 600000, // 10 minutes ago
    updatedAt: now,
    targetAudience: 'all',
    title: 'TYPHOON WARNING',
    message: 'Typhoon approaching Camarines Norte',
    severity: 'warning',
    deliveryMethod: ['push', 'in_app'],
    createdBy: 'admin-1',
  },
  {
    id: 'alert-2',
    createdAt: now - 3600000, // 1 hour ago
    updatedAt: now,
    targetAudience: 'all',
    title: 'EVACUATION ADVISORY',
    message: 'Residents near rivers should prepare to evacuate',
    severity: 'emergency',
    deliveryMethod: ['push', 'in_app', 'sms'],
    createdBy: 'admin-1',
  },
]

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCollection.mockReset()
  })

  it('returns alerts on successful fetch', async () => {
    mockGetCollection.mockResolvedValue(mockAlerts)

    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].id).toBe('alert-1')
  })

  it('is in loading state while fetching', () => {
    mockGetCollection.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('sets isError on fetch failure', async () => {
    mockGetCollection.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('filters out expired alerts', async () => {
    const expiredAlert: Alert = {
      ...mockAlerts[0],
      id: 'expired',
      expiresAt: now - 1000, // expired 1 second ago
    }
    mockGetCollection.mockResolvedValue([...mockAlerts, expiredAlert])

    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Only the 2 non-expired alerts should appear
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.find((a) => a.id === 'expired')).toBeUndefined()
  })

  it('keeps alerts with no expiresAt', async () => {
    mockGetCollection.mockResolvedValue(mockAlerts) // neither has expiresAt

    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toHaveLength(2)
  })

  it('keeps alerts whose expiresAt is in the future', async () => {
    const futureAlert: Alert = {
      ...mockAlerts[0],
      id: 'future',
      expiresAt: now + 3600000, // expires in 1 hour
    }
    mockGetCollection.mockResolvedValue([futureAlert])

    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data?.[0].id).toBe('future')
  })
})
