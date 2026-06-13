import { describe, expect, it } from 'vitest'

import { buildReportReadiness } from './report-readiness.js'

describe('buildReportReadiness', () => {
  it('suggests a short description when type and location are present', () => {
    const readiness = buildReportReadiness({
      reportType: 'flood',
      description: '',
      peopleInjured: false,
      peopleTrapped: false,
      locationMethod: 'manual',
      municipalityLabel: 'Daet',
      barangayId: 'Barangay 1',
      location: { lat: 14.1, lng: 122.9 },
      photoAttached: false,
    })

    expect(readiness.level).toBe('good')
    expect(readiness.lines).toContain(
      'Your incident type and location are included. Adding a short description may help responders verify faster.',
    )
  })

  it('explains the consequence when location is missing', () => {
    const readiness = buildReportReadiness({
      reportType: 'fire',
      description: 'Smoke near the road',
      peopleInjured: false,
      peopleTrapped: false,
      locationMethod: 'manual',
      location: { lat: 0, lng: 0 },
      photoAttached: true,
    })

    expect(readiness.level).toBe('needs-attention')
    expect(readiness.lines).toContain(
      'Without location, responders may not know where to verify the incident. Add location or describe the nearest landmark.',
    )
  })

  it('flags a missing incident type even when location is present', () => {
    const readiness = buildReportReadiness({
      reportType: '',
      description: 'Water is rising near the road',
      peopleInjured: false,
      peopleTrapped: false,
      locationMethod: 'manual',
      municipalityLabel: 'Daet',
      location: { lat: 14.1, lng: 122.9 },
      photoAttached: true,
    })

    expect(readiness.level).toBe('needs-attention')
    expect(readiness.lines).toContain(
      'Add an incident type so responders know what kind of help may be needed.',
    )
  })
})
