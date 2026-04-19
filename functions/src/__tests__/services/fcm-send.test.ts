import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSendEachForMulticast, mockCollection, mockDoc, mockGet, mockUpdate } = vi.hoisted(
  () => {
    return {
      mockSendEachForMulticast: vi.fn(),
      mockCollection: vi.fn(),
      mockDoc: vi.fn(),
      mockGet: vi.fn(),
      mockUpdate: vi.fn(),
    }
  },
)

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => ({
    sendEachForMulticast: mockSendEachForMulticast,
  })),
}))

vi.mock('../../admin-init.js', () => ({
  adminDb: {
    collection: mockCollection.mockReturnValue({
      doc: mockDoc.mockReturnValue({
        get: mockGet,
        update: mockUpdate,
      }),
    }),
  },
}))

import { sendFcmToResponder } from '../../services/fcm-send.js'
import { FieldValue } from 'firebase-admin/firestore'

describe('sendFcmToResponder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns warning when responder document does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false })

    const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_no_token'])
  })

  it('returns warning when responder has no tokens', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: [] }) })

    const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_no_token'])
  })

  it('sends multicast and returns empty warnings on success', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: ['token1'] }) })
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [{ success: true }],
    })

    const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual([])
    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['token1'],
      notification: { title: 'T', body: 'B' },
    })
  })

  it('removes invalid tokens on failure', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ fcmTokens: ['valid', 'invalid'] }),
    })
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    })

    const arrayRemoveSpy = vi
      .spyOn(FieldValue, 'arrayRemove')
      .mockReturnValue('array_remove_mock' as any) // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument

    const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_one_token_invalid'])
    expect(mockUpdate).toHaveBeenCalledWith({
      fcmTokens: 'array_remove_mock',
    })
    expect(arrayRemoveSpy).toHaveBeenCalledWith('invalid')
  })

  it('retries once on transport failure', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: ['token1'] }) })
    mockSendEachForMulticast
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        responses: [{ success: true }],
      })

    const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual([])
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2)
  })

  it('returns network error warning on retry failure', async () => {
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: ['token1'] }) })
    mockSendEachForMulticast
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error 2'))

    const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_network_error'])
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2)
  })
})
