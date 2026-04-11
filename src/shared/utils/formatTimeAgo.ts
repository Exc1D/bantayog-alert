/**
 * Formats a Unix timestamp (ms) into a short relative time string.
 * Shared across features (feed, alerts) for consistent time display.
 *
 *   < 60s  → "just now"
 *   < 60m  → "Xm ago"
 *   < 24h  → "Xh ago"
 *   < 7d   → "Xd ago"
 *   < 4w   → "Xw ago"
 *   < 12mo → "Xmo ago"
 *   else   → "Xy ago"
 */
export function formatTimeAgo(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000)

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  }

  if (seconds < intervals.minute) return 'just now'

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit)
    if (interval >= 1) {
      const unitChar = unit === 'month' ? 'mo' : unit.charAt(0)
      return `${interval}${unitChar} ago`
    }
  }

  return 'just now'
}
