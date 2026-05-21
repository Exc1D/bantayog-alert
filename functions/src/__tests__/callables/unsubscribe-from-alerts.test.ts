import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockUnsubscribeFromTopic } = vi.hoisted(() => ({
  mockUnsubscribeFromTopic: vi.fn(),
}))

vi.mock('firebase-admin', () => ({
  messaging: vi.fn(() => ({
    unsubscribeFromTopic: mockUnsubscribeFromTopic,
  })),
}))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  return { ...actual, onCall: vi.fn((_config: unknown, handler: unknown) => handler) }
})

vi.mock('../../admin-init.js', () => ({ adminDb: {} }))

import { unsubscribeFromAlertsCore } from '../../domains/alerts/unsubscribe-to-alerts.js'

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

    const result = await unsubscribeFromAlertsCore({
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

    const result = await unsubscribeFromAlertsCore({
      token: 'unregistered-token',
      actor: { uid: 'user-123' },
    })

    expect(result).toEqual({ success: true })
  })

  it('propagates messaging errors', async () => {
    mockUnsubscribeFromTopic.mockRejectedValueOnce(new Error('messaging error'))

    await expect(
      unsubscribeFromAlertsCore({ token: 'bad-token', actor: { uid: 'user-123' } }),
    ).rejects.toThrow('messaging error')
  })
})
