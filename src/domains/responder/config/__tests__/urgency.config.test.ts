/**
 * Tests for urgency.config.ts
 *
 * Covers:
 * - calculateUrgency time-based urgency classification
 * - SOS_EXPIRATION_MS constant value
 * - SOS_CANCELLATION_WINDOW_MS constant value
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  calculateUrgency,
  SOS_EXPIRATION_MS,
  SOS_CANCELLATION_WINDOW_MS,
} from '../urgency.config'

describe('urgency.config', () => {
  describe('SOS_EXPIRATION_MS', () => {
    it('should equal 4 hours in milliseconds', () => {
      expect(SOS_EXPIRATION_MS).toBe(4 * 60 * 60 * 1000)
    })

    it('should equal 14400000 ms', () => {
      expect(SOS_EXPIRATION_MS).toBe(14_400_000)
    })
  })

  describe('SOS_CANCELLATION_WINDOW_MS', () => {
    it('should equal 30 seconds in milliseconds', () => {
      expect(SOS_CANCELLATION_WINDOW_MS).toBe(30 * 1000)
    })

    it('should equal 30000 ms', () => {
      expect(SOS_CANCELLATION_WINDOW_MS).toBe(30_000)
    })

    it('should be much less than SOS_EXPIRATION_MS', () => {
      expect(SOS_CANCELLATION_WINDOW_MS).toBeLessThan(SOS_EXPIRATION_MS)
    })
  })

  describe('calculateUrgency', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "high" for dispatches created within the last 15 minutes', () => {
      vi.useFakeTimers()
      const now = Date.now()
      // 1 minute ago
      vi.setSystemTime(now + 60 * 1000)
      const createdAt = now
      expect(calculateUrgency(createdAt)).toBe('high')
    })

    it('should return "high" for a dispatch just created (0 ms ago)', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)
      expect(calculateUrgency(now)).toBe('high')
    })

    it('should return "high" for a dispatch created exactly at 15 minutes (boundary)', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now + 15 * 60 * 1000)
      // Exactly at boundary: age === 15 minutes, not > 15 minutes
      expect(calculateUrgency(now)).toBe('high')
    })

    it('should return "medium" for a dispatch created just over 15 minutes ago', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now + 15 * 60 * 1000 + 1)
      expect(calculateUrgency(now)).toBe('medium')
    })

    it('should return "medium" for a dispatch created 20 minutes ago', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now + 20 * 60 * 1000)
      expect(calculateUrgency(now)).toBe('medium')
    })

    it('should return "medium" for a dispatch created exactly at 30 minutes (boundary)', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now + 30 * 60 * 1000)
      // Exactly at 30-minute boundary: age === 30 minutes, not > 30 minutes
      expect(calculateUrgency(now)).toBe('medium')
    })

    it('should return "low" for a dispatch created just over 30 minutes ago', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now + 30 * 60 * 1000 + 1)
      expect(calculateUrgency(now)).toBe('low')
    })

    it('should return "low" for a dispatch created 1 hour ago', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now + 60 * 60 * 1000)
      expect(calculateUrgency(now)).toBe('low')
    })

    it('should return "low" for a very old dispatch (24 hours ago)', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now + 24 * 60 * 60 * 1000)
      expect(calculateUrgency(now)).toBe('low')
    })

    it('should return DispatchUrgency type values only', () => {
      vi.useFakeTimers()
      const now = Date.now()
      const validValues = ['high', 'medium', 'low']

      vi.setSystemTime(now + 5 * 60 * 1000)
      expect(validValues).toContain(calculateUrgency(now))

      vi.setSystemTime(now + 20 * 60 * 1000)
      expect(validValues).toContain(calculateUrgency(now))

      vi.setSystemTime(now + 45 * 60 * 1000)
      expect(validValues).toContain(calculateUrgency(now))
    })
  })
})