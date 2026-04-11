/**
 * Time filter utilities for disaster report filtering.
 * Provides preset time ranges and helper functions for time-based filtering.
 */

/**
 * Preset time range options for filtering reports
 */
export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all'

/**
 * Time range labels for UI display
 */
export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1H',
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
  all: 'ALL',
}

/**
 * Time range in milliseconds for each preset
 */
export const TIME_RANGE_MS: Record<TimeRange, number | null> = {
  '1h': 60 * 60 * 1000, // 1 hour
  '24h': 24 * 60 * 60 * 1000, // 24 hours
  '7d': 7 * 24 * 60 * 60 * 1000, // 7 days
  '30d': 30 * 24 * 60 * 60 * 1000, // 30 days
  all: null, // No time restriction
}

/**
 * Calculate the cutoff timestamp for a given time range.
 *
 * @param timeRange - The time range preset
 * @param currentTime - Current timestamp in milliseconds (defaults to Date.now())
 * @returns Cutoff timestamp, or null if timeRange is 'all' (no cutoff)
 *
 * @example
 * ```ts
 * const cutoff = getTimeCutoff('1h') // Returns timestamp for 1 hour ago
 * const cutoff = getTimeCutoff('all') // Returns null (no filter)
 * ```
 */
export function getTimeCutoff(timeRange: TimeRange, currentTime: number = Date.now()): number | null {
  const ms = TIME_RANGE_MS[timeRange]
  if (ms === null) {
    return null
  }
  return currentTime - ms
}

/**
 * Check if a report timestamp is within the specified time range.
 *
 * @param reportTimestamp - The report's timestamp in milliseconds
 * @param timeRange - The time range preset
 * @param currentTime - Current timestamp in milliseconds (defaults to Date.now())
 * @returns true if the report timestamp is within the time range
 *
 * @example
 * ```ts
 * const isRecent = isWithinTimeRange(Date.now(), '1h') // true
 * const isOld = isWithinTimeRange(Date.now() - 7200000, '1h') // false (2 hours ago)
 * const isAll = isWithinTimeRange(anyTimestamp, 'all') // true (no filter)
 * ```
 */
export function isWithinTimeRange(
  reportTimestamp: number,
  timeRange: TimeRange,
  currentTime: number = Date.now()
): boolean {
  const cutoff = getTimeCutoff(timeRange, currentTime)
  if (cutoff === null) {
    return true // 'all' means no time filter
  }
  return reportTimestamp >= cutoff
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago").
 * This is a simplified version for time filter display.
 *
 * @param timestamp - The timestamp to format
 * @param currentTime - Current timestamp in milliseconds (defaults to Date.now())
 * @returns Relative time string
 *
 * @example
 * ```ts
 * formatRelativeTime(Date.now()) // "Just now"
 * formatRelativeTime(Date.now() - 3600000) // "1 hour ago"
 * formatRelativeTime(Date.now() - 7200000) // "2 hours ago"
 * ```
 */
export function formatRelativeTime(timestamp: number, currentTime: number = Date.now()): string {
  const diff = currentTime - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return 'Just now'
  }
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
