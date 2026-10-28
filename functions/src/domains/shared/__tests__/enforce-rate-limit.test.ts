import { describe, it, expect, vi } from 'vitest'
import type { Firestore, Timestamp } from 'firebase-admin/firestore'

const mockCheckRateLimit = vi.hoisted(() => vi.fn())
vi.mock('../rate-limit.js', () => ({ checkRateLimit: mockCheckRateLimit }))

import { enforceRateLimit } from '../enforce-rate-limit.js'

const db = {} as Firestore
const check = { key: 'k', limit: 1, windowSeconds: 60, now: {} as Timestamp }

describe('enforceRateLimit', () => {
  it('resolves when allowed', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 0, retryAfterSeconds: 0 })
    await expect(enforceRateLimit(db, check)).resolves.toBeUndefined()
  })

  it('throws resource-exhausted with retryAfterSeconds when denied', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 7 })
    await expect(enforceRateLimit(db, check, 'slow down')).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: 'slow down',
      details: { retryAfterSeconds: 7 },
    })
  })
})
