import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())
const mockGetDoc = vi.hoisted(() => vi.fn())
const mockDoc = vi.hoisted(() => vi.fn(() => ({ path: 'dispatches/disp-1' })))

vi.mock('../app/firebase', () => ({
  db: {},
}))
vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  getDoc: mockGetDoc,
}))

import { useDispatch } from './useDispatch'

describe('useDispatch', () => {
  function makeValidDispatchData(overrides: Record<string, unknown> = {}) {
    return {
      reportId: 'rep-1',
      assignedTo: { uid: 'uid-1', agencyId: 'agency-1', municipalityId: 'muni-1' },
      dispatchedBy: 'admin-1',
      dispatchedByRole: 'municipal_admin',
      dispatchedAt: { toMillis: () => 1000 },
      status: 'pending',
      statusUpdatedAt: { toMillis: () => 2000 },
      acknowledgementDeadlineAt: { toMillis: () => 3000 },
      idempotencyKey: 'key-1',
      idempotencyPayloadHash: 'a'.repeat(64),
      schemaVersion: 1,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns undefined dispatch when dispatchId is not provided', async () => {
    const { result } = renderHook(() => useDispatch(undefined))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.dispatch).toBeUndefined()
    expect(result.current.error).toBeUndefined()
  })

  it('maps a valid Firestore snapshot to DispatchDoc', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        id: 'disp-1',
        data: () => makeValidDispatchData(),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useDispatch('disp-1'))

    await waitFor(() => {
      expect(result.current.dispatch).toBeDefined()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeUndefined()
    expect(result.current.dispatch?.dispatchId).toBe('disp-1')
    expect(result.current.dispatch?.status).toBe('pending')
    expect(result.current.dispatch?.uiStatus).toBe('pending')
  })

  it('sets loading to false when document does not exist', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => false,
        id: 'disp-missing',
        data: () => ({}),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useDispatch('disp-missing'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.dispatch).toBeUndefined()
    expect(result.current.error).toBeUndefined()
  })

  it('surfaces listener error', async () => {
    mockOnSnapshot.mockImplementation((_ref, _onNext, onError) => {
      onError(new Error('permission_denied'))
      return vi.fn()
    })

    const { result } = renderHook(() => useDispatch('disp-1'))

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.dispatch).toBeUndefined()
  })

  it('refresh fetches document and updates state', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        id: 'disp-1',
        data: () => makeValidDispatchData(),
      })
      return vi.fn()
    })

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'disp-1',
      data: () =>
        makeValidDispatchData({
          status: 'acknowledged',
          acknowledgedAt: { toMillis: () => 4000 },
        }),
    })

    const { result } = renderHook(() => useDispatch('disp-1'))

    await waitFor(() => {
      expect(result.current.dispatch).toBeDefined()
    })
    expect(result.current.dispatch?.status).toBe('pending')

    await result.current.refresh()

    await waitFor(() => {
      expect(result.current.dispatch?.status).toBe('acknowledged')
    })
    expect(result.current.loading).toBe(false)
  })

  it('maps resolved status to resolved uiStatus and null terminalSurface', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        id: 'disp-resolved',
        data: () =>
          makeValidDispatchData({
            status: 'resolved',
            resolvedAt: { toMillis: () => 5000 },
          }),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useDispatch('disp-resolved'))

    await waitFor(() => {
      expect(result.current.dispatch).toBeDefined()
    })

    expect(result.current.dispatch?.uiStatus).toBe('resolved')
    expect(result.current.dispatch?.terminalSurface).toBeNull()
  })

  it('maps cancelled status to terminal surface', async () => {
    mockOnSnapshot.mockImplementation((_ref, onNext) => {
      onNext({
        exists: () => true,
        id: 'disp-cancelled',
        data: () =>
          makeValidDispatchData({
            status: 'cancelled',
            cancelledAt: { toMillis: () => 5000 },
          }),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useDispatch('disp-cancelled'))

    await waitFor(() => {
      expect(result.current.dispatch).toBeDefined()
    })

    expect(result.current.dispatch?.uiStatus).toBe('terminal')
    expect(result.current.dispatch?.terminalSurface).toBe('cancelled')
  })
})
