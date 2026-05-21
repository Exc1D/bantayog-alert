import { describe, it, expect, beforeEach, vi } from 'vitest'
import { type Firestore } from 'firebase-admin/firestore'

const { mockUnsubscribeFromTopic } = vi.hoisted(() => ({
  mockUnsubscribeFromTopic: vi.fn(),
}))

vi.mock('firebase-admin', () => ({
  messaging: vi.fn(() => ({
    unsubscribeFromTopic: mockUnsubscribeFromTopic,
  })),
}))

vi.mock('../../../admin-init.js', () => ({
  adminDb: {},
}))

function createMockDb(userDoc?: { fcmToken?: string; fcmTokens?: string[] }) {
  const collectionFn = vi.fn((collectionPath: string) => {
    return {
      doc: vi.fn(() => {
        const data =
          collectionPath === 'responders'
            ? { fcmTokens: userDoc?.fcmTokens ?? [] }
            : { fcmToken: userDoc?.fcmToken ?? null }
        const exists =
          collectionPath === 'responders'
            ? (userDoc?.fcmTokens ?? []).length > 0
            : userDoc?.fcmToken !== undefined
        return {
          get: vi.fn().mockResolvedValue({ exists, data: () => data }),
        }
      }),
    }
  })
  return {
    collection: collectionFn,
  } as unknown as Firestore
}

import { unsubscribeFromAlertsCore } from '../unsubscribe-to-alerts.js'

describe('unsubscribeFromAlertsCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unsubscribes token from alerts topic', async () => {
    mockUnsubscribeFromTopic.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 0,
      errors: [],
    })

    const db = createMockDb({ fcmToken: 'test-fcm-token' })
    const result = await unsubscribeFromAlertsCore(db, {
      token: 'test-fcm-token',
      actor: { uid: 'user-123' },
    })

    expect(mockUnsubscribeFromTopic).toHaveBeenCalledWith(['test-fcm-token'], 'alerts')
    expect(result).toEqual({ success: true })
  })

  it('returns success when token was not subscribed', async () => {
    mockUnsubscribeFromTopic.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 1,
      errors: [],
    })

    const db = createMockDb({ fcmToken: 'unregistered-token' })
    const result = await unsubscribeFromAlertsCore(db, {
      token: 'unregistered-token',
      actor: { uid: 'user-123' },
    })

    expect(result).toEqual({ success: true })
  })

  it('propagates messaging errors', async () => {
    mockUnsubscribeFromTopic.mockRejectedValueOnce(new Error('messaging error'))

    const db = createMockDb({ fcmToken: 'bad-token' })
    await expect(
      unsubscribeFromAlertsCore(db, { token: 'bad-token', actor: { uid: 'user-123' } }),
    ).rejects.toThrow('messaging error')
  })

  it('rejects token not belonging to caller', async () => {
    const db = createMockDb({ fcmToken: 'other-token' })
    await expect(
      unsubscribeFromAlertsCore(db, { token: 'stolen-token', actor: { uid: 'user-123' } }),
    ).rejects.toThrow('does not belong')
  })
})
