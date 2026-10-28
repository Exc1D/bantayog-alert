import type { Firestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { checkRateLimit, type RateLimitCheck } from './rate-limit.js'

// Lives apart from rate-limit.ts so tests that mock `checkRateLimit` via
// vi.mock('../../shared/rate-limit.js') still drive this helper.
export async function enforceRateLimit(
  db: Firestore,
  check: RateLimitCheck,
  message = 'rate limit exceeded',
): Promise<void> {
  const { allowed, retryAfterSeconds } = await checkRateLimit(db, check)
  if (!allowed) throw new HttpsError('resource-exhausted', message, { retryAfterSeconds })
}
