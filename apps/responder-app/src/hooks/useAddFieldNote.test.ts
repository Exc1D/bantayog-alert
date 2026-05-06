import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockAddDoc = vi.hoisted(() => vi.fn())
const mockCollection = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'uid-1', displayName: 'BFP Responder 01' } },
}))
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  serverTimestamp: () => ({ _type: 'serverTimestamp' }),
}))
vi.mock('../app/await-auth-token', () => ({
  awaitFreshAuthToken: () => Promise.resolve({ uid: 'uid-1', displayName: 'BFP Responder 01' }),
}))

import { useAddFieldNote } from './useAddFieldNote'

describe('useAddFieldNote', () => {
  it('writes field note with authorUid/body schema matching firestore rules', async () => {
    mockCollection.mockReturnValue({ path: 'reports/r1/field_notes' })
    mockAddDoc.mockResolvedValue({ id: 'note-1' })

    const { result } = renderHook(() => useAddFieldNote('r1'))

    await act(async () => {
      await result.current.addNote('Water is rising fast')
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: 'Water is rising fast',
        authorUid: 'uid-1',
        authorRole: 'responder',
        authorDisplayName: 'BFP Responder 01',
        schemaVersion: 1,
      }),
    )
  })

  it('throws if content is empty', async () => {
    const { result } = renderHook(() => useAddFieldNote('r1'))
    await expect(
      act(async () => {
        await result.current.addNote('   ')
      }),
    ).rejects.toThrow('content_required')
  })
})
