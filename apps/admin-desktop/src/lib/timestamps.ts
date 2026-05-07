/**
 * Converts Firestore Timestamps or raw millisecond values to epoch milliseconds.
 *
 * Firestore writes return Timestamp objects with toMillis(), while some legacy
 * data may be stored as raw numbers. Returns 0 for invalid values to prevent
 * crashes, but this may mask data integrity issues.
 */
export function toMs(val: unknown): number {
  if (
    val !== null &&
    typeof val === 'object' &&
    typeof (val as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis()
  }
  if (typeof val === 'number') return val
  return 0 // Consistent fallback - invalid data shows as epoch
}
