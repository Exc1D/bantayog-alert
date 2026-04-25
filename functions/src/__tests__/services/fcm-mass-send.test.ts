import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendEachForMulticast = vi.hoisted(() => vi.fn())
const mockCollection = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => ({
    sendEachForMulticast: mockSendEachForMulticast,
  })),
}))

function createMockDb(docs: { id: string; fcmTokens?: string[]; municipalityId: string }[]) {
  const querySnap = {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d,
    })),
  }
  const secondWhere = {
    get: mockGet.mockResolvedValue(querySnap),
  }
  const firstWhere = {
    where: vi.fn().mockReturnValue(secondWhere),
  }
  return {
    collection: mockCollection.mockReturnValue({
      where: vi.fn().mockReturnValue(firstWhere),
    }),
  } as unknown as import('firebase-admin/firestore').Firestore
}

import { sendMassAlertFcm } from '../../services/fcm-mass-send.js'

describe('sendMassAlertFcm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zeros for empty municipalityIds', async () => {
    const db = createMockDb([])
    const result = await sendMassAlertFcm(db, {
      municipalityIds: [],
      title: 'T',
      body: 'B',
    })
    expect(result).toEqual({ successCount: 0, failureCount: 0, batchCount: 0 })
    expect(mockCollection).not.toHaveBeenCalled()
  })

  it('deduplicates tokens across responders', async () => {
    const db = createMockDb([
      { id: 'r1', fcmTokens: ['token-a', 'token-b'], municipalityId: 'daet' },
      { id: 'r2', fcmTokens: ['token-b', 'token-c'], municipalityId: 'daet' },
    ])
    mockSendEachForMulticast.mockResolvedValueOnce({ successCount: 3, failureCount: 0 })

    const result = await sendMassAlertFcm(db, {
      municipalityIds: ['daet'],
      title: 'T',
      body: 'B',
    })
    expect(result.successCount).toBe(3)
    expect(mockSendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['token-a', 'token-b', 'token-c'],
      }),
    )
  })

  it('chunks municipalityIds to respect Firestore in-query limit', async () => {
    const db = createMockDb(
      Array.from({ length: 12 }, (_, i) => ({
        id: `r${String(i)}`,
        fcmTokens: [`token-${String(i)}`],
        municipalityId: `muni-${String(i)}`,
      })),
    )
    mockSendEachForMulticast.mockResolvedValue({ successCount: 1, failureCount: 0 })

    await sendMassAlertFcm(db, {
      municipalityIds: Array.from({ length: 12 }, (_, i) => `muni-${String(i)}`),
      title: 'T',
      body: 'B',
    })

    // Two chunks: 10 + 2 municipalityIds → 2 separate queries
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('refuses send when token count exceeds hard cap', async () => {
    const tokens = Array.from({ length: 5001 }, (_, i) => `token-${String(i)}`)
    const db = createMockDb([{ id: 'r1', fcmTokens: tokens, municipalityId: 'daet' }])

    const result = await sendMassAlertFcm(db, {
      municipalityIds: ['daet'],
      title: 'T',
      body: 'B',
    })
    expect(result).toEqual({ successCount: 0, failureCount: 5001, batchCount: 0 })
    expect(mockSendEachForMulticast).not.toHaveBeenCalled()
  })

  it('batches large token lists into groups of 500', async () => {
    const tokens = Array.from({ length: 1200 }, (_, i) => `token-${String(i)}`)
    const db = createMockDb([{ id: 'r1', fcmTokens: tokens, municipalityId: 'daet' }])
    mockSendEachForMulticast.mockResolvedValue({ successCount: 500, failureCount: 0 })

    const result = await sendMassAlertFcm(db, {
      municipalityIds: ['daet'],
      title: 'T',
      body: 'B',
    })
    expect(result.batchCount).toBe(3)
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(3)
  })

  it('counts batch failures on sendEachForMulticast error', async () => {
    const db = createMockDb([{ id: 'r1', fcmTokens: ['t1', 't2'], municipalityId: 'daet' }])
    mockSendEachForMulticast.mockRejectedValueOnce(new Error('Network error'))

    const result = await sendMassAlertFcm(db, {
      municipalityIds: ['daet'],
      title: 'T',
      body: 'B',
    })
    expect(result.failureCount).toBe(2)
    expect(result.successCount).toBe(0)
  })
})
