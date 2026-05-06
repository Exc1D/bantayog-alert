import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Vite define replacement — must be set before the module under test is imported
const ORIGINAL_APP_VERSION = (globalThis as Record<string, unknown>).__APP_VERSION__
;(globalThis as Record<string, unknown>).__APP_VERSION__ = '1.0.0'

const mockOnSnapshot = vi.hoisted(() => vi.fn())
const mockDoc = vi.hoisted(() =>
  vi.fn((_db: unknown, _collection: string, docId: string) => ({ path: `system_config/${docId}` })),
)

vi.mock('../app/firebase', () => ({
  db: {},
}))
vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
}))

import { useVersionGate } from './useVersionGate'

describe('useVersionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    ;(globalThis as Record<string, unknown>).__APP_VERSION__ = ORIGINAL_APP_VERSION
  })

  it('sets blocked=true when app version is older than minimum', async () => {
    mockOnSnapshot.mockImplementation((ref, handlers) => {
      const isMinVersion = ref.path?.includes('min_app_version')
      handlers.next({
        exists: () => true,
        data: () =>
          isMinVersion ? { responder: '1.1.0' } : { responder: 'https://update.example.com' },
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useVersionGate())

    await waitFor(() => {
      expect(result.current.blocked).toBe(true)
    })
    expect(result.current.updateUrl).toBe('https://update.example.com')
  })

  it('sets blocked=false when app version meets minimum', async () => {
    mockOnSnapshot.mockImplementation((ref, handlers) => {
      const isMinVersion = ref.path?.includes('min_app_version')
      handlers.next({
        exists: () => true,
        data: () => (isMinVersion ? { responder: '0.0.1' } : {}),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useVersionGate())

    await waitFor(() => {
      expect(result.current.blocked).toBe(false)
    })
  })

  it('sets blocked=true and updateUrl null when update_urls doc is missing', async () => {
    mockOnSnapshot.mockImplementation((ref, handlers) => {
      const isMinVersion = ref.path?.includes('min_app_version')
      handlers.next({
        exists: () => isMinVersion,
        data: () => (isMinVersion ? { responder: '99.0.0' } : {}),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useVersionGate())

    await waitFor(() => {
      expect(result.current.blocked).toBe(true)
    })
    expect(result.current.updateUrl).toBeNull()
  })

  it('defaults to blocked=true on listener error', async () => {
    mockOnSnapshot.mockImplementation((_ref, handlers) => {
      handlers.error(new Error('network_error'))
      return vi.fn()
    })

    const { result } = renderHook(() => useVersionGate())

    await waitFor(() => {
      expect(result.current.blocked).toBe(true)
    })
  })
})
