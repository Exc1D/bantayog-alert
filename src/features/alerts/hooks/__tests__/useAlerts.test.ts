/**
 * useAlerts Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAlerts } from '../useAlerts'
import type { Alert } from '@/shared/types/firestore.types'
import type { UserRole } from '@/shared/types/auth.types'

// ── Mock alert.service.ts ──────────────────────────────────────────────────────

const { subscribeToAlertsMock, subscribeToAlertsByMunicipalityMock } = vi.hoisted(() => {
  return {
    subscribeToAlertsMock: vi.fn(),
    subscribeToAlertsByMunicipalityMock: vi.fn(),
  }
})

vi.mock('../../services/alert.service', () => ({
  subscribeToAlerts: subscribeToAlertsMock,
  subscribeToAlertsByMunicipality: subscribeToAlertsByMunicipalityMock,
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

// ── Shared test data factory ───────────────────────────────────────────────────

function makeAlert(overrides: Partial<Alert> & { id: string }): Alert {
  return {
    id: 'default-id',
    createdAt: now - 60000,
    updatedAt: now,
    targetAudience: 'all',
    title: 'Default Alert',
    message: 'Default message',
    severity: 'warning',
    deliveryMethod: ['in_app'],
    createdBy: 'admin',
    ...overrides,
  }
}

// ── Existing tests — updated for new onSnapshot API ────────────────────────────
// The hook was rewritten to use onSnapshot; these tests now verify the same
// contracts (loading state, alerts returned, error state) via the new API.

describe('useAlerts (legacy — onSnapshot contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribeToAlertsMock.mockReset()
    subscribeToAlertsByMunicipalityMock.mockReset()
    subscribeToAlertsMock.mockReturnValue(vi.fn())
    subscribeToAlertsByMunicipalityMock.mockReturnValue(vi.fn())
  })

  it('returns alerts on successful subscription', async () => {
    subscribeToAlertsMock.mockImplementation((_filters, callback) => {
      setTimeout(() => callback(mockAlerts), 0)
      return vi.fn()
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useAlerts(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.alerts).toHaveLength(2)
    expect(result.current.alerts[0].id).toBe('alert-1')
  })

  it('starts in loading state before first snapshot', () => {
    subscribeToAlertsMock.mockImplementation(() => vi.fn())

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useAlerts(), { wrapper })

    // Before the effect runs, isLoading should be true
    expect(result.current.isLoading).toBe(true)
    expect(result.current.alerts).toEqual([])
  })

  it('sets isError=true when onSnapshot emits an error', async () => {
    subscribeToAlertsMock.mockImplementation((_filters, _callback, onError) => {
      setTimeout(() => onError?.(new Error('Network error')), 0)
      return vi.fn()
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useAlerts(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── New onSnapshot-based tests ────────────────────────────────────────────────

describe('onSnapshot Subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribeToAlertsMock.mockReset()
    subscribeToAlertsByMunicipalityMock.mockReset()
    subscribeToAlertsMock.mockReturnValue(vi.fn())
    subscribeToAlertsByMunicipalityMock.mockReturnValue(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state', () => {
    subscribeToAlertsMock.mockImplementation(() => vi.fn())
    const { result } = renderHook(() => useAlerts())
    expect(result.current.isLoading).toBe(true)
    expect(result.current.alerts).toEqual([])
  })

  it('sets isLoading=false and populates alerts after first snapshot', async () => {
    subscribeToAlertsMock.mockImplementation((_filters, callback) => {
      // Simulate async first snapshot (as Firestore does)
      setTimeout(() => callback([makeAlert({ id: 'snap-1' })]), 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useAlerts())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.alerts).toHaveLength(1)
    expect(result.current.alerts[0].id).toBe('snap-1')
  })

  it('calls subscribeToAlerts when no municipality is provided', () => {
    subscribeToAlertsMock.mockReturnValue(vi.fn())
    renderHook(() => useAlerts())
    expect(subscribeToAlertsMock).toHaveBeenCalledTimes(1)
  })

  it('calls subscribeToAlertsByMunicipality when municipality is provided', () => {
    subscribeToAlertsByMunicipalityMock.mockReturnValue(vi.fn())
    renderHook(() => useAlerts({ municipality: 'Daet' }))
    expect(subscribeToAlertsByMunicipalityMock).toHaveBeenCalledTimes(1)
    expect(subscribeToAlertsByMunicipalityMock).toHaveBeenCalledWith(
      'Daet',
      expect.any(Function),
      expect.any(Function)
    )
  })

  it('sets isError=true when onSnapshot emits an error', async () => {
    subscribeToAlertsMock.mockImplementation((_filters, _callback, onError) => {
      setTimeout(() => onError?.(new Error('Firestore permission denied')), 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useAlerts())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('unsubscribes on unmount', () => {
    const unsubscribeMock = vi.fn()
    subscribeToAlertsMock.mockReturnValue(unsubscribeMock)

    const { unmount } = renderHook(() => useAlerts())
    unmount()

    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
  })

  it('populates error field when onError callback is called', async () => {
    subscribeToAlertsMock.mockImplementation((_filters, _callback, onError) => {
      setTimeout(() => onError?.(new Error('Snapshot error')), 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useAlerts())

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.error?.message).toBe('Snapshot error')
  })
})

describe('Multiple Query Merge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscribeToAlertsMock.mockReset()
    subscribeToAlertsByMunicipalityMock.mockReset()
    subscribeToAlertsMock.mockReturnValue(vi.fn())
    subscribeToAlertsByMunicipalityMock.mockReturnValue(vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs both listeners when municipality AND role are provided', () => {
    renderHook(() => useAlerts({ municipality: 'Daet', role: 'citizen' as UserRole }))

    // subscribeToAlerts covers role-based alerts; subscribeToAlertsByMunicipality covers location
    expect(subscribeToAlertsMock).toHaveBeenCalledTimes(1)
    expect(subscribeToAlertsByMunicipalityMock).toHaveBeenCalledTimes(1)
  })

  it('merges and deduplicates results when both listeners fire', async () => {
    const alertA = makeAlert({ id: 'a', title: 'Alert A' })
    const alertB = makeAlert({ id: 'b', title: 'Alert B' })
    const alertC = makeAlert({ id: 'c', title: 'Alert C' }) // duplicate — same id as A

    subscribeToAlertsMock.mockImplementation((_filters, callback) => {
      setTimeout(() => callback([alertA, alertB]), 0)
      return vi.fn()
    })
    subscribeToAlertsByMunicipalityMock.mockImplementation((_municipality, callback) => {
      setTimeout(() => callback([alertA, alertC]), 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useAlerts({ municipality: 'Daet', role: 'citizen' as UserRole }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // alertA appears in both; should be deduplicated
    expect(result.current.alerts).toHaveLength(3)
    const ids = result.current.alerts.map((a: Alert) => a.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
  })
})
