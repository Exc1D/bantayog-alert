import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSendEachForMulticast, mockPrivateGet, mockUserGet, mockUserUpdate } = vi.hoisted(() => {
  return {
    mockSendEachForMulticast: vi.fn(),
    mockPrivateGet: vi.fn(),
    mockUserGet: vi.fn(),
    mockUserUpdate: vi.fn(),
  }
})

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => ({
    sendEachForMulticast: mockSendEachForMulticast,
  })),
}))

vi.mock('../../../admin-init.js', () => ({
  adminDb: {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() =>
        name === 'report_private'
          ? { get: mockPrivateGet }
          : { get: mockUserGet, update: mockUserUpdate },
      ),
    })),
  },
}))

import { sendFcmToCitizen } from '../fcm-send.js'

function privateDoc(reporterUid?: string) {
  mockPrivateGet.mockResolvedValueOnce({
    exists: true,
    data: () => (reporterUid === undefined ? {} : { reporterUid }),
  })
}

function userDoc(fcmToken?: unknown) {
  mockUserGet.mockResolvedValueOnce({
    exists: true,
    data: () => (fcmToken === undefined ? {} : { fcmToken }),
  })
}

describe('sendFcmToCitizen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns warning when report_private doc does not exist', async () => {
    mockPrivateGet.mockResolvedValueOnce({ exists: false })

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_no_token'])
    expect(mockSendEachForMulticast).not.toHaveBeenCalled()
  })

  it('returns warning when report_private has no reporterUid', async () => {
    privateDoc(undefined)

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_no_token'])
  })

  it('returns warning when user doc does not exist', async () => {
    privateDoc('citizen1')
    mockUserGet.mockResolvedValueOnce({ exists: false })

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_no_token'])
  })

  it('returns warning when user has no fcmToken string', async () => {
    privateDoc('citizen1')
    userDoc(null)

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_no_token'])
    expect(mockSendEachForMulticast).not.toHaveBeenCalled()
  })

  it('sends to the single token and returns empty warnings on success', async () => {
    privateDoc('citizen1')
    userDoc('ctoken1')
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [{ success: true }],
    })

    const result = await sendFcmToCitizen({
      reportId: 'rep1',
      title: 'Help is on the way',
      body: 'A responder was dispatched.',
      data: { reportId: 'rep1' },
    })
    expect(result.warnings).toEqual([])
    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['ctoken1'],
      notification: { title: 'Help is on the way', body: 'A responder was dispatched.' },
      data: { reportId: 'rep1' },
    })
  })

  it('retries once on transport failure', async () => {
    privateDoc('citizen1')
    userDoc('ctoken1')
    mockSendEachForMulticast
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ responses: [{ success: true }] })

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual([])
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2)
  })

  it('returns network error warning on retry failure', async () => {
    privateDoc('citizen1')
    userDoc('ctoken1')
    mockSendEachForMulticast
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockRejectedValueOnce(new Error('Network Error 2'))

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_network_error'])
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2)
  })

  it('clears the stored token when it is invalid', async () => {
    privateDoc('citizen1')
    userDoc('deadtoken')
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    })

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_one_token_invalid'])
    expect(mockUserUpdate).toHaveBeenCalledWith({ fcmToken: null })
  })

  it('never throws when token cleanup fails', async () => {
    privateDoc('citizen1')
    userDoc('deadtoken')
    mockSendEachForMulticast.mockResolvedValueOnce({
      responses: [{ success: false, error: { code: 'messaging/invalid-registration-token' } }],
    })
    mockUserUpdate.mockRejectedValueOnce(new Error('update denied'))

    const result = await sendFcmToCitizen({ reportId: 'rep1', title: 'T', body: 'B' })
    expect(result.warnings).toEqual(['fcm_one_token_invalid'])
  })
})
