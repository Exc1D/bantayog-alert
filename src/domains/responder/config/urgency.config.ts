import type { DispatchUrgency } from '../types'

/**
 * Calculate dispatch urgency based on age
 */
export function calculateUrgency(createdAt: number): DispatchUrgency {
  const age = Date.now() - createdAt

  if (age > 30 * 60 * 1000) return 'low'   // >30 minutes
  if (age > 15 * 60 * 1000) return 'medium' // >15 minutes
  return 'high'                             // ≤15 minutes
}

/**
 * SOS expiration time (4 hours)
 */
export const SOS_EXPIRATION_MS = 4 * 60 * 60 * 1000

/**
 * SOS cancellation window (30 seconds)
 */
export const SOS_CANCELLATION_WINDOW_MS = 30 * 1000
