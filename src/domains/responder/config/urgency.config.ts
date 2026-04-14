import type { DispatchUrgency } from '../types'

/**
 * Urgency threshold constants (in milliseconds)
 */
const HIGH_URGENCY_THRESHOLD_MS = 15 * 60 * 1000    // ≤15 minutes = high
const MEDIUM_URGENCY_THRESHOLD_MS = 30 * 60 * 1000  // ≤30 minutes = medium

/**
 * Calculate dispatch urgency based on age.
 * Future timestamps (negative age) default to medium urgency.
 */
export function calculateUrgency(createdAt: number): DispatchUrgency {
  const age = Date.now() - createdAt
  if (age < 0) return 'medium'  // Future timestamps: treat as medium urgency
  if (age > MEDIUM_URGENCY_THRESHOLD_MS) return 'low'
  if (age > HIGH_URGENCY_THRESHOLD_MS) return 'medium'
  return 'high'
}

/**
 * SOS expiration time (4 hours)
 */
export const SOS_EXPIRATION_MS = 4 * 60 * 60 * 1000

/**
 * SOS cancellation window (30 seconds)
 */
export const SOS_CANCELLATION_WINDOW_MS = 30 * 1000
