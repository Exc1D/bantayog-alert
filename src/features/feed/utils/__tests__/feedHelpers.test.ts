/**
 * Feed Helper Utilities Tests
 */

import { describe, it, expect } from 'vitest'
import {
  truncateText,
  formatReportType,
  formatLocationName,
  formatTimeAgo,
} from '../feedHelpers'

describe('truncateText', () => {
  it('should return text as-is if shorter than max length', () => {
    const text = 'Short text'
    expect(truncateText(text, 150)).toBe(text)
  })

  it('should return text as-is if exactly max length', () => {
    const text = 'a'.repeat(150)
    expect(truncateText(text, 150)).toBe(text)
  })

  it('should truncate text longer than max length', () => {
    const text = 'a'.repeat(200)
    const result = truncateText(text, 150)
    expect(result).toHaveLength(150) // 147 chars + '...'
    expect(result.endsWith('...')).toBe(true)
  })

  it('should trim whitespace before adding ellipsis', () => {
    const text = 'Hello world ' + 'a'.repeat(140)
    const result = truncateText(text, 150)
    expect(result.endsWith('...')).toBe(true)
    expect(result).not.toContain('  ')
  })

  it('should use custom max length', () => {
    const text = 'a'.repeat(100)
    expect(truncateText(text, 50)).toHaveLength(50) // 47 chars + '...'
  })
})

describe('formatReportType', () => {
  it('should format known incident types', () => {
    expect(formatReportType('flood')).toBe('Flood')
    expect(formatReportType('medical_emergency')).toBe('Medical Emergency')
    expect(formatReportType('infrastructure')).toBe('Infrastructure Issue')
  })

  it('should handle unknown incident types', () => {
    expect(formatReportType('unknown_type')).toBe('unknown_type')
    expect(formatReportType('custom_type')).toBe('custom_type')
  })

  it('should handle all defined types', () => {
    const types = [
      'flood',
      'earthquake',
      'landslide',
      'fire',
      'typhoon',
      'medical_emergency',
      'accident',
      'infrastructure',
      'crime',
      'other',
    ] as const

    types.forEach((type) => {
      const result = formatReportType(type)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })
  })
})

describe('formatLocationName', () => {
  it('should format positive coordinates correctly', () => {
    const coords = { latitude: 14.1234, longitude: 122.5678 }
    const result = formatLocationName(coords)
    expect(result).toBe('14.1234° N, 122.5678° E')
  })

  it('should format negative coordinates correctly', () => {
    const coords = { latitude: -14.1234, longitude: -122.5678 }
    const result = formatLocationName(coords)
    expect(result).toBe('14.1234° S, 122.5678° W')
  })

  it('should handle mixed positive and negative coordinates', () => {
    const coords = { latitude: 14.1234, longitude: -122.5678 }
    const result = formatLocationName(coords)
    expect(result).toBe('14.1234° N, 122.5678° W')
  })

  it('should format to 4 decimal places', () => {
    const coords = { latitude: 14.12345678, longitude: 122.56789012 }
    const result = formatLocationName(coords)
    expect(result).toBe('14.1235° N, 122.5679° E')
  })

  it('should handle zero coordinates', () => {
    const coords = { latitude: 0, longitude: 0 }
    const result = formatLocationName(coords)
    expect(result).toBe('0.0000° N, 0.0000° E')
  })
})

describe('formatTimeAgo', () => {
  it('should return "just now" for very recent timestamps', () => {
    const now = Date.now()
    expect(formatTimeAgo(now)).toBe('just now')
    expect(formatTimeAgo(now - 30000)).toBe('just now') // 30 seconds ago
  })

  it('should format minutes ago', () => {
    const now = Date.now()
    const oneMinAgo = now - 60 * 1000
    const fiveMinsAgo = now - 5 * 60 * 1000

    expect(formatTimeAgo(oneMinAgo)).toBe('1m ago')
    expect(formatTimeAgo(fiveMinsAgo)).toBe('5m ago')
  })

  it('should format hours ago', () => {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const threeHoursAgo = now - 3 * 60 * 60 * 1000

    expect(formatTimeAgo(oneHourAgo)).toBe('1h ago')
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago')
  })

  it('should format days ago', () => {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000

    expect(formatTimeAgo(oneDayAgo)).toBe('1d ago')
    expect(formatTimeAgo(sixDaysAgo)).toBe('6d ago')
  })

  it('should format weeks ago', () => {
    const now = Date.now()
    const twoWeeksAgo = now - 2 * 7 * 24 * 60 * 60 * 1000

    expect(formatTimeAgo(twoWeeksAgo)).toBe('2w ago')
  })

  it('should format months ago', () => {
    const now = Date.now()
    const twoMonthsAgo = now - 2 * 30 * 24 * 60 * 60 * 1000

    expect(formatTimeAgo(twoMonthsAgo)).toBe('2mo ago')
  })

  it('should format years ago', () => {
    const now = Date.now()
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000

    expect(formatTimeAgo(oneYearAgo)).toBe('1y ago')
  })
})
