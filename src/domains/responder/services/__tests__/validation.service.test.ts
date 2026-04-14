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

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-uid' },
  })),
}))

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

    it('should accept location with latitude 0 but non-zero longitude', () => {
      // Only (0, 0) is rejected — (0, non-zero) is valid (equator + non-zero longitude)
      const location = createLocation(0, 122.7417)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(true)
    })

    it('should accept location with longitude 0 but non-zero latitude', () => {
      // Only (0, 0) is rejected — (non-zero, 0) is valid (Prime Meridian)
      const location = createLocation(14.2972, 0)
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(true)
    })

    it('should return no code or message for valid coordinates', () => {
      const location = createLocation(37.7749, -122.4194) // San Francisco
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(true)
      expect(result.code).toBeUndefined()
      expect(result.message).toBeUndefined()
    })

    it('should reject (0, 0) regardless of other metadata fields', () => {
      const location: RichLocation = {
        latitude: 0,
        longitude: 0,
        accuracy: 1,
        altitude: 100,
        altitudeAccuracy: 5,
        heading: 45,
        speed: 10,
        timestamp: Date.now(),
        source: 'gps',
      }
      const result = validateGPSLocation(location)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('INVALID_COORDS')
    })
  })

  describe('canUpdateStatus edge cases', () => {
    it('should return valid for empty dispatch id (placeholder implementation)', async () => {
      const result = await canUpdateStatus('', 'en_route')

      expect(result.valid).toBe(true)
    })

    it('should return valid regardless of dispatchId value', async () => {
      const result1 = await canUpdateStatus('any-id', 'completed')
      const result2 = await canUpdateStatus('another-id', 'needs_assistance')

      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(true)
    })
  })
})
