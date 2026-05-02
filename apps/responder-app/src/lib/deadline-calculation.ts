import { Timestamp } from 'firebase/firestore'

/**
 * Calculate the acknowledgement deadline in minutes from dispatch data.
 * Falls back to 3 minutes if deadline or dispatch time is missing.
 */
export function calculateDeadlineMinutes(
  deadlineAt: Timestamp | undefined,
  dispatchedAt: Timestamp | undefined,
  fallbackMinutes = 3
): number {
  if (!deadlineAt || !dispatchedAt) return fallbackMinutes
  const diffMs = deadlineAt.toMillis() - dispatchedAt.toMillis()
  return Math.max(1, Math.round(diffMs / 60000))
}
