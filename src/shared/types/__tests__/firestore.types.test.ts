/**
 * Type validation tests for Firestore type models
 *
 * These tests validate the Alert interface structure and its optional
 * government alert extensions (affectedAreas, type, source, sourceUrl, isActive).
 */

import { describe, it, expect } from 'vitest'
import type { Alert } from '../firestore.types'

// ---------------------------------------------------------------------------
// Manual validators (no Zod in this project — use simple type guards)
// ---------------------------------------------------------------------------

type AlertSource = 'mdrrmo' | 'pagasa' | 'phivOLCS' | 'ndrrmc' | 'local_gov' | 'barangay'
type AlertType = 'rainfall' | 'flood' | 'typhoon' | 'earthquake' | 'landslide' | 'fire' | 'medical' | 'other'

function isValidAlertSource(val: unknown): val is AlertSource {
  return ['mdrrmo', 'pagasa', 'phivOLCS', 'ndrrmc', 'local_gov', 'barangay'].includes(val as string)
}

function isValidAlertType(val: unknown): val is AlertType {
  return ['rainfall', 'flood', 'typhoon', 'earthquake', 'landslide', 'fire', 'medical', 'other'].includes(val as string)
}

function isValidAffectedAreas(alert: Partial<Alert>): boolean {
  if (alert.affectedAreas === undefined) return true
  const areas = alert.affectedAreas as Record<string, unknown>
  // If affectedAreas is present, it must have municipalities (array of strings)
  if (!areas || typeof areas !== 'object') return false
  if (!Array.isArray((areas as { municipalities?: unknown }).municipalities)) return false
  return true
}

function validateAlert(alert: Partial<Alert>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Affected areas: if present, must have municipalities
  if (!isValidAffectedAreas(alert)) {
    errors.push('affectedAreas must have municipalities array when present')
  }

  // Source: must be a known government source value
  if (alert.source !== undefined && !isValidAlertSource(alert.source)) {
    errors.push(`source must be a known government source (got: ${alert.source})`)
  }

  // Type: must be a known alert type value
  if (alert.type !== undefined && !isValidAlertType(alert.type)) {
    errors.push(`type must be a known alert type (got: ${alert.type})`)
  }

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Alert type validation', () => {
  describe('government alert fields', () => {
    it('should accept valid Alert with all government alert fields', () => {
      const alert: Partial<Alert> = {
        id: 'alert-1',
        createdAt: Date.now(),
        targetAudience: 'all',
        title: 'Flood Warning',
        message: 'Heavy rainfall expected',
        severity: 'warning',
        deliveryMethod: ['push', 'sms'],
        createdBy: 'admin-1',
        // Government alert fields
        affectedAreas: { municipalities: ['daet', 'basud', 'vinzons'] },
        type: 'flood',
        source: 'mdrrmo',
        sourceUrl: 'https://mdrrmo.gov.ph/advisory/123',
        isActive: true,
      }

      const result = validateAlert(alert)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should accept Alert with only system notification fields', () => {
      const alert: Partial<Alert> = {
        id: 'alert-2',
        createdAt: Date.now(),
        targetAudience: 'all',
        title: 'System Maintenance',
        message: 'Scheduled downtime tonight',
        severity: 'info',
        deliveryMethod: ['in_app'],
        createdBy: 'admin-1',
        // No government alert fields
      }

      const result = validateAlert(alert)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should accept Alert with isActive: true', () => {
      const alert: Partial<Alert> = {
        id: 'alert-3',
        createdAt: Date.now(),
        targetAudience: 'all',
        title: 'Active Alert',
        message: 'This alert is active',
        severity: 'warning',
        deliveryMethod: ['push'],
        createdBy: 'admin-1',
        isActive: true,
      }

      const result = validateAlert(alert)
      expect(result.valid).toBe(true)
    })

    it('should accept Alert with isActive: undefined', () => {
      const alert: Partial<Alert> = {
        id: 'alert-4',
        createdAt: Date.now(),
        targetAudience: 'all',
        title: 'Alert without isActive',
        message: 'Defaults to active',
        severity: 'info',
        deliveryMethod: ['in_app'],
        createdBy: 'admin-1',
        isActive: undefined,
      }

      const result = validateAlert(alert)
      expect(result.valid).toBe(true)
    })

    it('should reject Alert with affectedAreas but missing municipalities', () => {
      const alert: Partial<Alert> = {
        id: 'alert-5',
        createdAt: Date.now(),
        targetAudience: 'all',
        title: 'Invalid Alert',
        message: 'Missing municipalities',
        severity: 'warning',
        deliveryMethod: ['push'],
        createdBy: 'admin-1',
        // affectedAreas is present but municipalities is missing
        affectedAreas: { province: 'Camarines Norte' } as Alert['affectedAreas'],
      }

      const result = validateAlert(alert)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('affectedAreas must have municipalities array when present')
    })

    it('should reject Alert with invalid source value', () => {
      const alert: Partial<Alert> = {
        id: 'alert-6',
        createdAt: Date.now(),
        targetAudience: 'all',
        title: 'Alert with bad source',
        message: 'Unknown source',
        severity: 'warning',
        deliveryMethod: ['push'],
        createdBy: 'admin-1',
        source: 'unknown_source' as Alert['source'],
      }

      const result = validateAlert(alert)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('source must be a known government source'))).toBe(true)
    })
  })
})
