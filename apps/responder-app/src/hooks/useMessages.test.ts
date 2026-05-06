import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segs: string[]) => ({ path: segs.join('/') })),
  query: vi.fn((arg: unknown) => arg),
  orderBy: vi.fn(),
  onSnapshot: mockOnSnapshot,
}))

import { useMessages } from './useMessages'

describe('useMessages', () => {
  it('returns sorted messages from snapshot', async () => {
    mockOnSnapshot.mockImplementation(
      (
        _ref: unknown,
        onNext: (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void,
      ) => {
        onNext({
          docs: [
            {
              id: 'msg-1',
              data: () => ({
                content: 'Hello from admin',
                senderRole: 'municipal_admin',
                senderDisplayName: 'Admin Santos',
                sentAt: { toMillis: () => 1700000000000 },
              }),
            },
          ],
        })
        return () => undefined
      },
    )

    const { result } = renderHook(() => useMessages('report-1'))

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]?.content).toBe('Hello from admin')
    })
  })

  it('returns empty when reportId is undefined', async () => {
    const { result } = renderHook(() => useMessages(undefined))
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(0)
      expect(result.current.loading).toBe(false)
    })
  })
})
