import { describe, it, expect } from 'vitest'
import { mapReportDocToReport, mapReportDocToReportLoose } from './map-report-doc'

describe('mapReportDocToReport', () => {
  const baseDoc = {
    id: 'report-1',
    type: 'flood',
    severity: 'high',
    municipality: 'Daet',
    barangay: 'Brgy 1',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'new',
    description: 'Test report',
  }

  describe('new field names (processInboxItem schema)', () => {
    const newDoc = {
      id: 'report-new-1',
      reportType: 'fire',
      severity: 'medium',
      municipalityLabel: 'Labo',
      barangayId: 'San Roque',
      submittedAt: 1713350400000,
      status: 'new',
      description: 'New schema report',
      publicLocation: { lat: 14.1, lng: 122.8 },
    }

    it('reads type from reportType field', () => {
      const result = mapReportDocToReport(newDoc)
      expect(result).not.toBeNull()
      expect(result!.type).toBe('fire')
    })

    it('falls back to type when reportType is missing', () => {
      const result = mapReportDocToReport({
        ...newDoc,
        reportType: undefined,
        type: 'earthquake',
      })
      expect(result).not.toBeNull()
      expect(result!.type).toBe('earthquake')
    })

    it('reads municipality from municipalityLabel', () => {
      const result = mapReportDocToReport(newDoc)
      expect(result).not.toBeNull()
      expect(result!.municipality).toBe('Labo')
    })

    it('reads barangay from barangayId', () => {
      const result = mapReportDocToReport(newDoc)
      expect(result).not.toBeNull()
      expect(result!.barangay).toBe('San Roque')
    })

    it('reads createdAt from submittedAt (epoch ms number)', () => {
      const result = mapReportDocToReport(newDoc)
      expect(result).not.toBeNull()
      expect(result!.createdAt).toBe(new Date(1713350400000).toISOString())
    })

    it('falls back to createdAt when submittedAt is missing', () => {
      const result = mapReportDocToReport({
        ...newDoc,
        submittedAt: undefined,
        createdAt: '2024-01-15T00:00:00Z',
      })
      expect(result).not.toBeNull()
      expect(result!.createdAt).toBe('2024-01-15T00:00:00Z')
    })

    it('handles createdAt as Firestore Timestamp object', () => {
      const result = mapReportDocToReport({
        ...newDoc,
        submittedAt: undefined,
        createdAt: {
          toDate: () => new Date('2026-05-14T14:02:00.000Z'),
          seconds: 1747228920,
          nanoseconds: 0,
        },
      })
      expect(result).not.toBeNull()
      expect(result!.createdAt).toBe('2026-05-14T14:02:00.000Z')
    })

    it('handles createdAt as Firestore Timestamp when submittedAt is also present (prefers submittedAt)', () => {
      const result = mapReportDocToReport({
        ...newDoc,
        createdAt: {
          toDate: () => new Date('2025-01-01T00:00:00.000Z'),
        },
      })
      expect(result).not.toBeNull()
      // submittedAt (1713350400000) takes precedence over createdAt Timestamp
      expect(result!.createdAt).toBe(new Date(1713350400000).toISOString())
    })
  })

  it('extracts coordinates from publicLocation.lat/lng', () => {
    const result = mapReportDocToReport({
      ...baseDoc,
      publicLocation: { lat: 14.1123, lng: 122.9554 },
    })
    expect(result).not.toBeNull()
    expect(result!.latitude).toBe(14.1123)
    expect(result!.longitude).toBe(122.9554)
  })

  it('falls back to top-level latitude/longitude', () => {
    const result = mapReportDocToReport({
      ...baseDoc,
      latitude: 14.1,
      longitude: 122.9,
    })
    expect(result).not.toBeNull()
    expect(result!.latitude).toBe(14.1)
    expect(result!.longitude).toBe(122.9)
  })

  it('falls back to location.latitude/location.longitude', () => {
    const result = mapReportDocToReport({
      ...baseDoc,
      location: { latitude: 14.2, longitude: 122.8 },
    })
    expect(result).not.toBeNull()
    expect(result!.latitude).toBe(14.2)
    expect(result!.longitude).toBe(122.8)
  })

  it('prefers publicLocation over top-level fields', () => {
    const result = mapReportDocToReport({
      ...baseDoc,
      latitude: 14.1,
      longitude: 122.9,
      publicLocation: { lat: 14.1123, lng: 122.9554 },
    })
    expect(result).not.toBeNull()
    expect(result!.latitude).toBe(14.1123)
    expect(result!.longitude).toBe(122.9554)
  })

  it('returns null when no valid coordinates exist', () => {
    const result = mapReportDocToReport(baseDoc)
    expect(result).toBeNull()
  })

  it('returns null for out-of-bounds coordinates', () => {
    const result = mapReportDocToReport({
      ...baseDoc,
      publicLocation: { lat: 91, lng: 122 },
    })
    expect(result).toBeNull()
  })

  it('normalizes type, severity, and status', () => {
    const result = mapReportDocToReport({
      ...baseDoc,
      type: 'public_disturbance',
      severity: 'critical',
      status: 'awaiting_verify',
      publicLocation: { lat: 14, lng: 122 },
    })
    expect(result).not.toBeNull()
    expect(result!.type).toBe('security')
    expect(result!.severity).toBe('low')
    expect(result!.status).toBe('awaiting_verify')
  })
})

describe('mapReportDocToReportLoose', () => {
  const baseDoc = {
    id: 'report-1',
    type: 'flood',
    severity: 'high',
    municipality: 'Daet',
    barangay: 'Brgy 1',
    createdAt: '2024-01-01T00:00:00Z',
    status: 'new',
    description: 'Test report',
  }

  it('returns a Report even when coordinates are missing', () => {
    const result = mapReportDocToReportLoose(baseDoc)
    expect(result.id).toBe('report-1')
    expect(result.latitude).toBe(0)
    expect(result.longitude).toBe(0)
  })

  it('returns a Report even when coordinates are out of bounds', () => {
    const result = mapReportDocToReportLoose({
      ...baseDoc,
      publicLocation: { lat: 91, lng: 200 },
    })
    expect(result.latitude).toBe(0)
    expect(result.longitude).toBe(0)
  })

  it('preserves valid coordinates from publicLocation', () => {
    const result = mapReportDocToReportLoose({
      ...baseDoc,
      publicLocation: { lat: 14.1, lng: 122.8 },
    })
    expect(result.latitude).toBe(14.1)
    expect(result.longitude).toBe(122.8)
  })

  it('normalizes type, severity, and status', () => {
    const result = mapReportDocToReportLoose({
      ...baseDoc,
      type: 'public_disturbance',
      severity: 'critical',
      status: 'awaiting_verify',
    })
    expect(result.type).toBe('security')
    expect(result.severity).toBe('low')
    expect(result.status).toBe('awaiting_verify')
  })

  it('reads new field names (reportType, municipalityLabel, barangayId, submittedAt)', () => {
    const result = mapReportDocToReportLoose({
      id: 'report-new-1',
      reportType: 'fire',
      severity: 'medium',
      municipalityLabel: 'Labo',
      barangayId: 'San Roque',
      submittedAt: 1713350400000,
      status: 'new',
      description: 'New schema report',
    })
    expect(result.type).toBe('fire')
    expect(result.municipality).toBe('Labo')
    expect(result.barangay).toBe('San Roque')
    expect(result.createdAt).toBe(new Date(1713350400000).toISOString())
  })

  it('handles createdAt as Firestore Timestamp object', () => {
    const result = mapReportDocToReportLoose({
      ...baseDoc,
      createdAt: {
        toDate: () => new Date('2026-05-14T14:02:00.000Z'),
        seconds: 1747228920,
        nanoseconds: 0,
      },
    })
    expect(result.createdAt).toBe('2026-05-14T14:02:00.000Z')
  })

  it('returns empty strings for missing description/municipality/barangay', () => {
    const result = mapReportDocToReportLoose({
      id: 'r1',
      severity: 'high',
      status: 'new',
    })
    expect(result.description).toBe('')
    expect(result.municipality).toBe('')
    expect(result.barangay).toBe('')
  })
})
