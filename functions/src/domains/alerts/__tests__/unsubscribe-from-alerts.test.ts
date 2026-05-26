import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

const { mockCheckRateLimit, mockUnsubscribeFromTopic } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockUnsubscribeFromTopic: vi.fn().mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    errors: [],
  }),
}))

vi.mock('firebase-admin', () => ({
  messaging: vi.fn(() => ({
    unsubscribeFromTopic: mockUnsubscribeFromTopic,
  })),
}))

vi.mock('../../../admin-init.js', () => ({
  adminDb: {},
}))

vi.mock('../../shared/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
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
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfterSeconds: 0,
    })
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
      now: Timestamp.now(),
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
      now: Timestamp.now(),
    })

    expect(result).toEqual({ success: true })
  })

  it('propagates messaging errors', async () => {
    mockUnsubscribeFromTopic.mockRejectedValueOnce(new Error('messaging error'))

    const db = createMockDb({ fcmToken: 'bad-token' })
    await expect(
      unsubscribeFromAlertsCore(db, {
        token: 'bad-token',
        actor: { uid: 'user-123' },
        now: Timestamp.now(),
      }),
    ).rejects.toThrow('messaging error')
  })

  it('rejects token not belonging to caller', async () => {
    const db = createMockDb({ fcmToken: 'other-token' })
    await expect(
      unsubscribeFromAlertsCore(db, {
        token: 'stolen-token',
        actor: { uid: 'user-123' },
        now: Timestamp.now(),
      }),
    ).rejects.toThrow('does not belong')
  })

  it('rejects when the caller exceeds the unsubscribe rate limit', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    })

    const db = createMockDb({ fcmToken: 'test-fcm-token' })
    await expect(
      unsubscribeFromAlertsCore(db, {
        token: 'test-fcm-token',
        actor: { uid: 'user-123' },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { retryAfterSeconds: 42 },
    })
    expect(mockUnsubscribeFromTopic).not.toHaveBeenCalled()
  })
})
