import { describe, it, expect } from 'vitest'
import {
  TYPE_ICONS,
  TYPE_LABELS,
  SEVERITY_COLORS,
  isValidReportType,
  normalizeReportType,
  isValidSeverity,
  normalizeSeverity,
  isValidReportStatus,
  normalizeReportStatus,
} from './report'

describe('report constants', () => {
  describe('isValidReportType', () => {
    it('returns true for known types', () => {
      expect(isValidReportType('flood')).toBe(true)
      expect(isValidReportType('fire')).toBe(true)
      expect(isValidReportType('other')).toBe(true)
    })

    it('returns false for unknown types', () => {
      expect(isValidReportType('public_disturbance')).toBe(false)
      expect(isValidReportType('drought')).toBe(false)
      expect(isValidReportType('')).toBe(false)
      expect(isValidReportType(null)).toBe(false)
      expect(isValidReportType(undefined)).toBe(false)
    })
  })

  describe('normalizeReportType', () => {
    it('returns the type for valid values', () => {
      expect(normalizeReportType('flood')).toBe('flood')
      expect(normalizeReportType('medical')).toBe('medical')
    })

    it('maps public_disturbance legacy alias to security', () => {
      expect(normalizeReportType('public_disturbance')).toBe('security')
    })

    it('returns "other" for invalid values', () => {
      expect(normalizeReportType('')).toBe('other')
      expect(normalizeReportType(null)).toBe('other')
      expect(normalizeReportType(undefined)).toBe('other')
    })
  })

  describe('isValidSeverity', () => {
    it('returns true for known severities', () => {
      expect(isValidSeverity('high')).toBe(true)
      expect(isValidSeverity('medium')).toBe(true)
      expect(isValidSeverity('low')).toBe(true)
    })

    it('returns false for unknown severities', () => {
      expect(isValidSeverity('critical')).toBe(false)
      expect(isValidSeverity('')).toBe(false)
      expect(isValidSeverity(null)).toBe(false)
      expect(isValidSeverity(undefined)).toBe(false)
    })
  })

  describe('normalizeSeverity', () => {
    it('returns the severity for valid values', () => {
      expect(normalizeSeverity('high')).toBe('high')
      expect(normalizeSeverity('low')).toBe('low')
    })

    it('returns "low" for invalid values', () => {
      expect(normalizeSeverity('critical')).toBe('low')
      expect(normalizeSeverity('')).toBe('low')
      expect(normalizeSeverity(null)).toBe('low')
      expect(normalizeSeverity(undefined)).toBe('low')
    })
  })

  describe('TYPE_ICONS', () => {
    it('contains all expected report types', () => {
      const expected = [
        'flood',
        'fire',
        'earthquake',
        'typhoon',
        'landslide',
        'storm_surge',
        'medical',
        'accident',
        'structural',
        'security',
        'other',
      ]
      for (const type of expected) {
        expect(TYPE_ICONS[type as keyof typeof TYPE_ICONS]).toBeDefined()
      }
    })
  })

  describe('TYPE_LABELS', () => {
    it('contains all expected report types', () => {
      const expected = [
        'flood',
        'fire',
        'earthquake',
        'typhoon',
        'landslide',
        'storm_surge',
        'medical',
        'accident',
        'structural',
        'security',
        'other',
      ]
      for (const type of expected) {
        expect(TYPE_LABELS[type as keyof typeof TYPE_LABELS]).toBeDefined()
      }
    })
  })

  describe('SEVERITY_COLORS', () => {
    it('contains all expected severities', () => {
      expect(SEVERITY_COLORS.high).toBe('var(--color-severity-high)')
      expect(SEVERITY_COLORS.medium).toBe('var(--color-severity-medium)')
      expect(SEVERITY_COLORS.low).toBe('var(--color-severity-low)')
    })
  })

  describe('isValidReportStatus', () => {
    it('returns true for known statuses', () => {
      expect(isValidReportStatus('new')).toBe(true)
      expect(isValidReportStatus('awaiting_verify')).toBe(true)
      expect(isValidReportStatus('resolved')).toBe(true)
    })

    it('returns false for unknown statuses', () => {
      expect(isValidReportStatus('pending')).toBe(false)
      expect(isValidReportStatus('')).toBe(false)
      expect(isValidReportStatus(null)).toBe(false)
      expect(isValidReportStatus(undefined)).toBe(false)
    })
  })

  describe('normalizeReportStatus', () => {
    it('returns the status for valid values', () => {
      expect(normalizeReportStatus('verified')).toBe('verified')
      expect(normalizeReportStatus('closed')).toBe('closed')
    })

    it('returns "new" for invalid values', () => {
      expect(normalizeReportStatus('pending')).toBe('new')
      expect(normalizeReportStatus('')).toBe('new')
      expect(normalizeReportStatus(null)).toBe('new')
      expect(normalizeReportStatus(undefined)).toBe('new')
    })
  })
})
