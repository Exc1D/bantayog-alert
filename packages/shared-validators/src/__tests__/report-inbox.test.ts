import { describe, it, expect } from 'vitest'
import { reportInboxPayloadSchema, reportInboxItemSchema } from '../report-inbox'

describe('reportInboxPayloadSchema', () => {
  it('should accept a valid GPS-based payload', () => {
    const valid = {
      type: 'flood',
      description: 'Water rising in barangay hall area',
      municipalityId: 'daet',
      barangayId: 'calasgasan',
      locationPrecision: 'gps',
      exactLocation: { latitude: 14.1123, longitude: 122.9556 },
    }
    expect(reportInboxPayloadSchema.parse(valid)).toEqual(valid)
  })

  it('should accept a barangay-only payload without exactLocation', () => {
    const valid = {
      type: 'landslide',
      description: 'Soil movement near highway',
      municipalityId: 'labo',
      barangayId: 'tulay_na_lupa',
      locationPrecision: 'barangay_only',
    }
    expect(reportInboxPayloadSchema.parse(valid)).toEqual(valid)
  })

  it('should reject payload with responder_witness source (blocked at inbox level)', () => {
    const invalid = {
      type: 'fire',
      description: 'Structure fire',
      municipalityId: 'daet',
      barangayId: 'lag-on',
      locationPrecision: 'gps',
      exactLocation: { latitude: 14.1, longitude: 122.9 },
      source: 'responder_witness',
    }
    expect(() => reportInboxPayloadSchema.parse(invalid)).toThrow()
  })

  it('should reject empty description', () => {
    const invalid = {
      type: 'flood',
      description: '',
      municipalityId: 'daet',
      barangayId: 'calasgasan',
      locationPrecision: 'gps',
    }
    expect(() => reportInboxPayloadSchema.parse(invalid)).toThrow()
  })
})

describe('reportInboxItemSchema', () => {
  it('should accept a valid inbox item', () => {
    const valid = {
      reporterUid: 'uid_abc123',
      clientCreatedAt: { seconds: 1713200000, nanoseconds: 0 },
      payload: {
        type: 'flood',
        description: 'Water rising fast',
        municipalityId: 'daet',
        barangayId: 'calasgasan',
        locationPrecision: 'gps',
        exactLocation: { latitude: 14.1123, longitude: 122.9556 },
      },
      idempotencyKey: 'idem_xyz789',
    }
    expect(reportInboxItemSchema.parse(valid)).toEqual(valid)
  })

  it('should reject missing idempotencyKey', () => {
    const invalid = {
      reporterUid: 'uid_abc123',
      clientCreatedAt: { seconds: 1713200000, nanoseconds: 0 },
      payload: {
        type: 'flood',
        description: 'Water rising',
        municipalityId: 'daet',
        barangayId: 'calasgasan',
        locationPrecision: 'gps',
      },
    }
    expect(() => reportInboxItemSchema.parse(invalid)).toThrow()
  })
})
