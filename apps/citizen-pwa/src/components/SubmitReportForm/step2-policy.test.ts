import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { describe, expect, it } from 'vitest'

import { validateStep2WhoWhere } from './step2-policy.js'

const daet = CAMARINES_NORTE_MUNICIPALITIES.find((m) => m.id === 'daet')

const validBaseInput = {
  location: null,
  locationMethod: 'manual' as const,
  selectedMunicipalityId: 'daet',
  selectedBarangayId: 'Bagasbas',
  nearestLandmark: 'Town plaza',
  reporterName: 'Ana',
  reporterMsisdn: '+639171234567',
  locationConfidence: 'approximate' as const,
}

describe('validateStep2WhoWhere', () => {
  it('advances manual input with municipality centroid and location details', () => {
    if (!daet?.centroid) throw new Error('Daet fixture must have a centroid')

    const result = validateStep2WhoWhere(validBaseInput)

    expect(result).toEqual({
      status: 'ok',
      next: {
        location: { lat: daet.centroid.lat, lng: daet.centroid.lng },
        reporterName: 'Ana',
        reporterMsisdn: '+639171234567',
        locationMethod: 'manual',
        locationConfidence: 'approximate',
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        barangayId: 'Bagasbas',
        nearestLandmark: 'Town plaza',
      },
    })
  })

  it('advances GPS input without manual municipality fields', () => {
    const result = validateStep2WhoWhere({
      ...validBaseInput,
      location: { lat: 14.1, lng: 122.95 },
      locationMethod: 'gps',
      selectedMunicipalityId: '',
      selectedBarangayId: undefined,
      nearestLandmark: '',
      locationConfidence: undefined,
    })

    expect(result).toEqual({
      status: 'ok',
      next: {
        location: { lat: 14.1, lng: 122.95 },
        reporterName: 'Ana',
        reporterMsisdn: '+639171234567',
        locationMethod: 'gps',
        locationConfidence: 'manual',
      },
    })
  })

  it('blocks manual input without a municipality', () => {
    const result = validateStep2WhoWhere({
      ...validBaseInput,
      selectedMunicipalityId: '',
    })

    expect(result).toEqual({
      status: 'error',
      errors: { municipality: 'Please select a municipality.' },
    })
  })

  it('blocks blank reporter name', () => {
    const result = validateStep2WhoWhere({
      ...validBaseInput,
      reporterName: '   ',
    })

    expect(result).toEqual({
      status: 'error',
      errors: { reporterName: 'Please enter your name.' },
    })
  })

  it('blocks blank reporter phone number', () => {
    const result = validateStep2WhoWhere({
      ...validBaseInput,
      reporterMsisdn: '',
    })

    expect(result).toEqual({
      status: 'error',
      errors: { reporterMsisdn: 'Please enter your phone number.' },
    })
  })
})
