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
  it('returns messages mapped from author/body schema', async () => {
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
                body: 'Hello from admin',
                authorUid: 'admin-1',
                authorRole: 'municipal_admin',
                authorDisplayName: 'Admin Santos',
                createdAt: { toMillis: () => 1700000000000 },
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
      const msg = result.current.messages[0]
      expect(msg?.body).toBe('Hello from admin')
      expect(msg?.authorUid).toBe('admin-1')
      expect(msg?.authorRole).toBe('municipal_admin')
      expect(msg?.authorDisplayName).toBe('Admin Santos')
      expect(msg?.createdAt).toBe(1700000000000)
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
