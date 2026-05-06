import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((arg: unknown) => arg),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: mockOnSnapshot,
}))

import { useDispatchHistory } from './useDispatchHistory'

describe('useDispatchHistory', () => {
  beforeEach(() => {
    mockOnSnapshot.mockClear()
  })

  it('returns past dispatches', async () => {
    mockOnSnapshot.mockImplementationOnce(
      (
        _ref: unknown,
        onNext: (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void,
      ) => {
        onNext({
          docs: [
            {
              id: 'disp-1',
              data: () => ({
                reportId: 'rep-1',
                status: 'resolved',
                dispatchedAt: { toMillis: () => 1700000000000 },
                resolvedAt: { toMillis: () => 1700003600000 },
              }),
            },
          ],
        })
        return () => undefined
      },
    )

    const { result } = renderHook(() => useDispatchHistory('uid-1'))

    await waitFor(() => {
      expect(result.current.history).toHaveLength(1)
      expect(result.current.history[0]?.status).toBe('resolved')
    })
  })

  it('returns empty history when uid is undefined', async () => {
    const { result } = renderHook(() => useDispatchHistory(undefined))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.history).toHaveLength(0)
    })
  })

  it('surfaces listener error', async () => {
    mockOnSnapshot.mockImplementationOnce((_ref, _onNext, onError) => {
      onError(new Error('permission_denied'))
      return () => undefined
    })

    const { result } = renderHook(() => useDispatchHistory('uid-1'))

    await waitFor(() => {
      expect(result.current.error).toBe('permission_denied')
      expect(result.current.loading).toBe(false)
    })
  })
})
