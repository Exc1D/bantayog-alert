/**
 * Tests for validation.service.ts
 *
 * Covers:
 * - canActivateSOS network checks
 * - canUpdateStatus placeholder validation
 * - validateGPSLocation coordinate validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  canActivateSOS,
  canUpdateStatus,
  validateGPSLocation,
} from '../validation.service'
import type { RichLocation } from '../../types'

describe('validation.service', () => {
  describe('canActivateSOS', () => {
    let originalOnLine: boolean

    beforeEach(() => {
      originalOnLine = navigator.onLine
    })

    afterEach(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true,
      })
    })

    it('should return invalid when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      })

      const result = await canActivateSOS()

      expect(result.valid).toBe(false)
      expect(result.code).toBe('SOS_OFFLINE')
      expect(result.message).toBe('SOS activation requires internet connection')
    })

    it('should return valid when online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      })

      const result = await canActivateSOS()

      expect(result.valid).toBe(true)
      expect(result.code).toBeUndefined()
      expect(result.message).toBeUndefined()
    })
  })

  describe('canUpdateStatus', () => {
    it('should always return valid (placeholder)', async () => {
      const result = await canUpdateStatus('dispatch-123', 'en_route')

      expect(result.valid).toBe(true)
    })

    it('should return valid for any QuickStatus value', async () => {
      const statuses = ['en_route', 'on_scene', 'needs_assistance', 'completed'] as const

      for (const status of statuses) {
        const result = await canUpdateStatus('dispatch-123', status)
        expect(result.valid).toBe(true)
      }
    })
  })

  describe('validateGPSLocation', () => {
    const createLocation = (lat: number, lng: number): RichLocation => ({
      latitude: lat,
      longitude: lng,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      timestamp: Date.now(),
      source: 'gps',
    })

    it('should reject coordinates (0,0)', () => {
      const location = createLocation(0, 0)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('INVALID_COORDS')
      expect(result.message).toBe('Invalid GPS coordinates (0,0)')
    })

    it('should reject out of range latitude (> 90)', () => {
      const location = createLocation(91, 122.7417)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('OUT_OF_RANGE')
      expect(result.message).toBe('Coordinates out of valid range')
    })

    it('should reject out of range latitude (< -90)', () => {
      const location = createLocation(-91, 122.7417)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('OUT_OF_RANGE')
    })

    it('should reject out of range longitude (> 180)', () => {
      const location = createLocation(14.2972, 181)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('OUT_OF_RANGE')
    })

    it('should reject out of range longitude (< -180)', () => {
      const location = createLocation(14.2972, -181)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('OUT_OF_RANGE')
    })

    it('should accept valid coordinates within range', () => {
      const location = createLocation(14.2972, 122.7417)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(true)
      expect(result.code).toBeUndefined()
      expect(result.message).toBeUndefined()
    })

    it('should accept boundary coordinates (exact limits)', () => {
      // Max bounds
      const maxLat = createLocation(90, 180)
      expect(validateGPSLocation(maxLat).valid).toBe(true)

      // Min bounds
      const minLat = createLocation(-90, -180)
      expect(validateGPSLocation(minLat).valid).toBe(true)
    })
  })
})
