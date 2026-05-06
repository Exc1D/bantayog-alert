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
  it('returns past dispatches', async () => {
    mockOnSnapshot.mockImplementation(
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
})
