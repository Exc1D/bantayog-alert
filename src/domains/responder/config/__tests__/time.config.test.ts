/**
 * Tests for time.config.ts
 *
 * Verifies that all time constants export correct numeric values
 * and that relationships between constants are consistent.
 */

import { describe, it, expect } from 'vitest'
import {
  FOUR_MINUTES_MS,
  OPTIMISTIC_TIMEOUT_MS,
  MAX_SYNC_RETRIES,
  SYNC_RETRY_DELAY_MS,
  SYNC_MAX_DELAY_MS,
} from '../time.config'

describe('time.config', () => {
  describe('FOUR_MINUTES_MS', () => {
    it('should equal 240000 milliseconds', () => {
      expect(FOUR_MINUTES_MS).toBe(240_000)
    })

    it('should equal 4 * 60 * 1000', () => {
      expect(FOUR_MINUTES_MS).toBe(4 * 60 * 1000)
    })
  })

  describe('OPTIMISTIC_TIMEOUT_MS', () => {
    it('should equal 30000 milliseconds', () => {
      expect(OPTIMISTIC_TIMEOUT_MS).toBe(30_000)
    })

    it('should equal 30 * 1000', () => {
      expect(OPTIMISTIC_TIMEOUT_MS).toBe(30 * 1000)
    })
  })

  describe('MAX_SYNC_RETRIES', () => {
    it('should equal 5', () => {
      expect(MAX_SYNC_RETRIES).toBe(5)
    })

    it('should be a positive integer', () => {
      expect(MAX_SYNC_RETRIES).toBeGreaterThan(0)
      expect(Number.isInteger(MAX_SYNC_RETRIES)).toBe(true)
    })
  })

  describe('SYNC_RETRY_DELAY_MS', () => {
    it('should equal 1000 milliseconds', () => {
      expect(SYNC_RETRY_DELAY_MS).toBe(1_000)
    })

    it('should be less than SYNC_MAX_DELAY_MS', () => {
      expect(SYNC_RETRY_DELAY_MS).toBeLessThan(SYNC_MAX_DELAY_MS)
    })
  })

  describe('SYNC_MAX_DELAY_MS', () => {
    it('should equal 30000 milliseconds', () => {
      expect(SYNC_MAX_DELAY_MS).toBe(30_000)
    })

    it('should equal OPTIMISTIC_TIMEOUT_MS (same duration)', () => {
      expect(SYNC_MAX_DELAY_MS).toBe(OPTIMISTIC_TIMEOUT_MS)
    })
  })

  describe('constant relationships', () => {
    it('FOUR_MINUTES_MS should be greater than OPTIMISTIC_TIMEOUT_MS', () => {
      expect(FOUR_MINUTES_MS).toBeGreaterThan(OPTIMISTIC_TIMEOUT_MS)
    })

    it('SYNC_MAX_DELAY_MS should be greater than SYNC_RETRY_DELAY_MS', () => {
      expect(SYNC_MAX_DELAY_MS).toBeGreaterThan(SYNC_RETRY_DELAY_MS)
    })

    it('all time values should be positive numbers', () => {
      expect(FOUR_MINUTES_MS).toBeGreaterThan(0)
      expect(OPTIMISTIC_TIMEOUT_MS).toBeGreaterThan(0)
      expect(SYNC_RETRY_DELAY_MS).toBeGreaterThan(0)
      expect(SYNC_MAX_DELAY_MS).toBeGreaterThan(0)
    })
  })
})
