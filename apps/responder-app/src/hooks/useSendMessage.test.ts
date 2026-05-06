import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockAddDoc = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'uid-1', displayName: 'BFP Responder 01' } },
}))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segs: string[]) => ({ path: segs.join('/') })),
  addDoc: mockAddDoc,
  serverTimestamp: () => ({ _type: 'serverTimestamp' }),
}))
vi.mock('../app/await-auth-token', () => ({
  awaitFreshAuthToken: () => Promise.resolve({ uid: 'uid-1', displayName: 'BFP Responder 01' }),
}))

import { useSendMessage } from './useSendMessage'

describe('useSendMessage', () => {
  it('writes message with authorUid/body schema matching firestore rules', async () => {
    mockAddDoc.mockResolvedValue({ id: 'msg-1' })
    const { result } = renderHook(() => useSendMessage('report-1'))

    await act(async () => {
      await result.current.send('Water rising fast')
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: 'Water rising fast',
        authorUid: 'uid-1',
        authorRole: 'responder',
        authorDisplayName: 'BFP Responder 01',
        schemaVersion: 1,
      }),
    )
  })

  it('throws if content is empty', async () => {
    const { result } = renderHook(() => useSendMessage('report-1'))
    await expect(
      act(async () => {
        await result.current.send('  ')
      }),
    ).rejects.toThrow('content_required')
  })
})
