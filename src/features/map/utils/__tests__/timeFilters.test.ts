import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getTimeCutoff,
  isWithinTimeRange,
  formatRelativeTime,
  TIME_RANGE_LABELS,
  TIME_RANGE_MS,
  type TimeRange,
} from '../timeFilters'

describe('timeFilters', () => {
  const NOW = 1_700_000_000_000 // Fixed timestamp for consistent tests

  describe('TIME_RANGE_LABELS', () => {
    it('should have correct labels', () => {
      expect(TIME_RANGE_LABELS['1h']).toBe('1H')
      expect(TIME_RANGE_LABELS['24h']).toBe('24H')
      expect(TIME_RANGE_LABELS['7d']).toBe('7D')
      expect(TIME_RANGE_LABELS['30d']).toBe('30D')
      expect(TIME_RANGE_LABELS.all).toBe('ALL')
    })
  })

  describe('TIME_RANGE_MS', () => {
    it('should have correct millisecond values', () => {
      expect(TIME_RANGE_MS['1h']).toBe(60 * 60 * 1000) // 3,600,000
      expect(TIME_RANGE_MS['24h']).toBe(24 * 60 * 60 * 1000) // 86,400,000
      expect(TIME_RANGE_MS['7d']).toBe(7 * 24 * 60 * 60 * 1000) // 604,800,000
      expect(TIME_RANGE_MS['30d']).toBe(30 * 24 * 60 * 60 * 1000) // 2,592,000,000
      expect(TIME_RANGE_MS.all).toBe(null) // No restriction
    })
  })

  describe('getTimeCutoff', () => {
    it('should return correct cutoff for 1h', () => {
      const cutoff = getTimeCutoff('1h', NOW)
      expect(cutoff).toBe(NOW - 60 * 60 * 1000)
    })

    it('should return correct cutoff for 24h', () => {
      const cutoff = getTimeCutoff('24h', NOW)
      expect(cutoff).toBe(NOW - 24 * 60 * 60 * 1000)
    })

    it('should return correct cutoff for 7d', () => {
      const cutoff = getTimeCutoff('7d', NOW)
      expect(cutoff).toBe(NOW - 7 * 24 * 60 * 60 * 1000)
    })

    it('should return correct cutoff for 30d', () => {
      const cutoff = getTimeCutoff('30d', NOW)
      expect(cutoff).toBe(NOW - 30 * 24 * 60 * 60 * 1000)
    })

    it('should return null for "all" time range', () => {
      const cutoff = getTimeCutoff('all', NOW)
      expect(cutoff).toBe(null)
    })

    it('should default to Date.now() when currentTime not provided', () => {
      const cutoff = getTimeCutoff('1h')
      expect(cutoff).toBeGreaterThan(0)
      expect(cutoff).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('isWithinTimeRange', () => {
    it('should return true for current timestamp with 1h range', () => {
      expect(isWithinTimeRange(NOW, '1h', NOW)).toBe(true)
    })

    it('should return true for timestamp 30 minutes ago with 1h range', () => {
      const thirtyMinAgo = NOW - 30 * 60 * 1000
      expect(isWithinTimeRange(thirtyMinAgo, '1h', NOW)).toBe(true)
    })

    it('should return false for timestamp 2 hours ago with 1h range', () => {
      const twoHoursAgo = NOW - 2 * 60 * 60 * 1000
      expect(isWithinTimeRange(twoHoursAgo, '1h', NOW)).toBe(false)
    })

    it('should return true for timestamp 23 hours ago with 24h range', () => {
      const twentyThreeHoursAgo = NOW - 23 * 60 * 60 * 1000
      expect(isWithinTimeRange(twentyThreeHoursAgo, '24h', NOW)).toBe(true)
    })

    it('should return false for timestamp 25 hours ago with 24h range', () => {
      const twentyFiveHoursAgo = NOW - 25 * 60 * 60 * 1000
      expect(isWithinTimeRange(twentyFiveHoursAgo, '24h', NOW)).toBe(false)
    })

    it('should return true for timestamp 6 days ago with 7d range', () => {
      const sixDaysAgo = NOW - 6 * 24 * 60 * 60 * 1000
      expect(isWithinTimeRange(sixDaysAgo, '7d', NOW)).toBe(true)
    })

    it('should return false for timestamp 8 days ago with 7d range', () => {
      const eightDaysAgo = NOW - 8 * 24 * 60 * 60 * 1000
      expect(isWithinTimeRange(eightDaysAgo, '7d', NOW)).toBe(false)
    })

    it('should return true for timestamp 29 days ago with 30d range', () => {
      const twentyNineDaysAgo = NOW - 29 * 24 * 60 * 60 * 1000
      expect(isWithinTimeRange(twentyNineDaysAgo, '30d', NOW)).toBe(true)
    })

    it('should return false for timestamp 31 days ago with 30d range', () => {
      const thirtyOneDaysAgo = NOW - 31 * 24 * 60 * 60 * 1000
      expect(isWithinTimeRange(thirtyOneDaysAgo, '30d', NOW)).toBe(false)
    })

    it('should return true for any timestamp with "all" range', () => {
      const ancientTimestamp = NOW - 365 * 24 * 60 * 60 * 1000 // 1 year ago
      expect(isWithinTimeRange(ancientTimestamp, 'all', NOW)).toBe(true)
      expect(isWithinTimeRange(NOW, 'all', NOW)).toBe(true)
    })

    it('should return true for timestamp exactly at cutoff boundary', () => {
      const oneHourAgo = NOW - 60 * 60 * 1000
      expect(isWithinTimeRange(oneHourAgo, '1h', NOW)).toBe(true)
    })

    it('should default to Date.now() when currentTime not provided', () => {
      const recentTimestamp = Date.now() - 30 * 60 * 1000 // 30 minutes ago
      expect(isWithinTimeRange(recentTimestamp, '1h')).toBe(true)
    })
  })

  describe('formatRelativeTime', () => {
    it('should return "Just now" for current timestamp', () => {
      expect(formatRelativeTime(NOW, NOW)).toBe('Just now')
    })

    it('should return "Just now" for timestamps less than 1 minute ago', () => {
      const thirtySecondsAgo = NOW - 30 * 1000
      expect(formatRelativeTime(thirtySecondsAgo, NOW)).toBe('Just now')
    })

    it('should return "1 minute ago" for 1 minute ago', () => {
      const oneMinuteAgo = NOW - 60 * 1000
      expect(formatRelativeTime(oneMinuteAgo, NOW)).toBe('1 minute ago')
    })

    it('should return "5 minutes ago" for 5 minutes ago', () => {
      const fiveMinutesAgo = NOW - 5 * 60 * 1000
      expect(formatRelativeTime(fiveMinutesAgo, NOW)).toBe('5 minutes ago')
    })

    it('should return "1 hour ago" for 1 hour ago', () => {
      const oneHourAgo = NOW - 60 * 60 * 1000
      expect(formatRelativeTime(oneHourAgo, NOW)).toBe('1 hour ago')
    })

    it('should return "3 hours ago" for 3 hours ago', () => {
      const threeHoursAgo = NOW - 3 * 60 * 60 * 1000
      expect(formatRelativeTime(threeHoursAgo, NOW)).toBe('3 hours ago')
    })

    it('should return "1 day ago" for 1 day ago', () => {
      const oneDayAgo = NOW - 24 * 60 * 60 * 1000
      expect(formatRelativeTime(oneDayAgo, NOW)).toBe('1 day ago')
    })

    it('should return "7 days ago" for 7 days ago', () => {
      const sevenDaysAgo = NOW - 7 * 24 * 60 * 60 * 1000
      expect(formatRelativeTime(sevenDaysAgo, NOW)).toBe('7 days ago')
    })

    it('should default to Date.now() when currentTime not provided', () => {
      const recentTimestamp = Date.now() - 5 * 60 * 1000 // 5 minutes ago
      const result = formatRelativeTime(recentTimestamp)
      expect(result).toContain('minute')
    })
  })
})
