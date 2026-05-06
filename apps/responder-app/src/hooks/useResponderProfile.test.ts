import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, _col: unknown, id: string) => ({ id })),
  onSnapshot: mockOnSnapshot,
}))

import { useResponderProfile } from './useResponderProfile'

describe('useResponderProfile', () => {
  it('returns profile data from snapshot', async () => {
    mockOnSnapshot.mockImplementationOnce(
      (
        _ref: unknown,
        onNext: (snap: { exists: () => boolean; data: () => Record<string, unknown> }) => void,
      ) => {
        onNext({
          exists: () => true,
          data: () => ({
            displayName: 'Officer Juan Dela Cruz',
            responderType: 'fire',
            agencyId: 'daet-bfp',
            availabilityStatus: 'available',
          }),
        })
        return () => undefined
      },
    )

    const { result } = renderHook(() => useResponderProfile('uid-1'))

    await waitFor(() => {
      expect(result.current.profile?.displayName).toBe('Officer Juan Dela Cruz')
      expect(result.current.profile?.responderType).toBe('fire')
    })
  })

  it('returns null when uid is undefined', async () => {
    const { result } = renderHook(() => useResponderProfile(undefined))
    await waitFor(() => {
      expect(result.current.profile).toBeNull()
      expect(result.current.loading).toBe(false)
    })
  })
})
