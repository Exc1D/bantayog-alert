import { describe, expect, it } from 'vitest'

import { isPublicIncidentData } from './public-incident-guard.js'

const validIncident = {
  reportType: 'flood',
  severity: 'high',
  status: 'verified',
  barangayId: 'barangay-1',
  municipalityLabel: 'Daet',
  publicLocation: { lat: 14.112, lng: 122.956 },
  submittedAt: 1765000000000,
  verifiedAt: 1765000000100,
}

function withoutField(field: keyof typeof validIncident): Record<string, unknown> {
  return Object.fromEntries(Object.entries(validIncident).filter(([key]) => key !== field))
}

describe('isPublicIncidentData', () => {
  it('accepts a valid public incident payload', () => {
    expect(isPublicIncidentData(validIncident)).toBe(true)
  })

  it.each([
    'reportType',
    'severity',
    'status',
    'barangayId',
    'municipalityLabel',
    'publicLocation',
    'submittedAt',
  ] as const)('rejects a payload missing %s', (field) => {
    expect(isPublicIncidentData(withoutField(field))).toBe(false)
  })

  it('rejects a malformed report type value', () => {
    expect(isPublicIncidentData({ ...validIncident, reportType: 'mystery' })).toBe(false)
  })

  it('rejects a malformed severity value', () => {
    expect(isPublicIncidentData({ ...validIncident, severity: 'urgent' })).toBe(false)
  })

  it('rejects a malformed status value', () => {
    expect(isPublicIncidentData({ ...validIncident, status: 'broadcasting' })).toBe(false)
  })

  it('rejects non-finite coordinates', () => {
    expect(
      isPublicIncidentData({
        ...validIncident,
        publicLocation: { lat: Number.NaN, lng: 122.956 },
      }),
    ).toBe(false)
  })

  it('rejects a malformed verifiedAt value', () => {
    expect(isPublicIncidentData({ ...validIncident, verifiedAt: 'now' })).toBe(false)
  })
})
