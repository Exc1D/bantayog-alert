import { describe, expect, it } from 'vitest'
import {
  reportDocSchema,
  reportPrivateDocSchema,
  reportOpsDocSchema,
  reportSharingDocSchema,
  reportContactsDocSchema,
  reportLookupDocSchema,
  reportInboxDocSchema,
  hazardTagSchema,
  inboxPayloadSchema,
} from './reports.js'

const ts = 1713350400000

describe('reportDocSchema', () => {
  it('accepts a canonical verified report', () => {
    expect(
      reportDocSchema.parse({
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        barangayId: 'calasgasan',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        status: 'verified',
        publicLocation: { lat: 14.11, lng: 122.95 },
        mediaRefs: [],
        description: 'knee-deep water',
        submittedAt: ts,
        verifiedAt: ts,
        retentionExempt: false,
        visibilityClass: 'public_alertable',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
        correlationId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toMatchObject({ status: 'verified' })
  })

  it('rejects an invalid status literal', () => {
    expect(() =>
      reportDocSchema.parse({
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        status: 'triaged',
        mediaRefs: [],
        description: 'x',
        submittedAt: ts,
        retentionExempt: false,
        visibilityClass: 'internal',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
        correlationId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow()
  })

  it('rejects unknown top-level keys via strict mode', () => {
    expect(() =>
      reportDocSchema.parse({
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        status: 'new',
        mediaRefs: [],
        description: 'x',
        submittedAt: ts,
        retentionExempt: false,
        visibilityClass: 'internal',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
        correlationId: '11111111-1111-4111-8111-111111111111',
        unknownField: 'oops',
      }),
    ).toThrow()
  })
})

describe('reportPrivateDocSchema', () => {
  it('accepts a canonical private report', () => {
    expect(
      reportPrivateDocSchema.parse({
        municipalityId: 'daet',
        reporterUid: 'uid-123',
        isPseudonymous: true,
        publicTrackingRef: 'TRK-ABC-123',
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ isPseudonymous: true })
  })

  it('rejects unknown keys', () => {
    expect(() =>
      reportPrivateDocSchema.parse({
        municipalityId: 'daet',
        reporterUid: 'uid-123',
        isPseudonymous: true,
        publicTrackingRef: 'TRK-ABC-123',
        createdAt: ts,
        schemaVersion: 1,
        extra: 'bad',
      }),
    ).toThrow()
  })
})

describe('reportOpsDocSchema', () => {
  it('accepts a canonical ops report', () => {
    expect(
      reportOpsDocSchema.parse({
        municipalityId: 'daet',
        status: 'verified',
        severity: 'high',
        createdAt: ts,
        agencyIds: [],
        activeResponderCount: 0,
        requiresLocationFollowUp: false,
        visibility: { scope: 'municipality', sharedWith: [] },
        updatedAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'verified' })
  })
})

describe('reportSharingDocSchema', () => {
  it('accepts a sharing config', () => {
    expect(
      reportSharingDocSchema.parse({
        ownerMunicipalityId: 'daet',
        reportId: 'r-1',
        sharedWith: ['mercedes'],
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ sharedWith: ['mercedes'] })
  })

  it('rejects if sharedWith is not array', () => {
    expect(() =>
      reportSharingDocSchema.parse({
        ownerMunicipalityId: 'daet',
        reportId: 'r-1',
        sharedWith: 'mercedes',
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      }),
    ).toThrow()
  })
})

describe('reportContactsDocSchema', () => {
  it('accepts a contacts doc', () => {
    expect(
      reportContactsDocSchema.parse({
        reportId: 'r-1',
        reporterUid: 'uid-1',
        reporterName: 'Juan',
        reporterPhoneHash: 'a'.repeat(64),
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ reporterName: 'Juan' })
  })
})

describe('reportLookupDocSchema', () => {
  it('accepts a lookup doc', () => {
    expect(
      reportLookupDocSchema.parse({
        publicTrackingRef: 'a1b2c3d4',
        reportId: 'r-1',
        tokenHash: 'f'.repeat(64),
        expiresAt: 1716000000000,
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ publicTrackingRef: 'a1b2c3d4' })
  })
})

describe('reportInboxDocSchema', () => {
  it('accepts an inbox item', () => {
    expect(
      reportInboxDocSchema.parse({
        reporterUid: 'uid-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k1',
        publicRef: 'a1b2c3d4',
        secretHash: 'f'.repeat(64),
        correlationId: '11111111-1111-4111-8111-111111111111',
        payload: { reportType: 'flood', description: 'x', source: 'web' },
      }),
    ).toMatchObject({ reporterUid: 'uid-1' })
  })

  it('rejects missing idempotencyKey', () => {
    expect(() =>
      reportInboxDocSchema.parse({
        reporterUid: 'uid-1',
        clientCreatedAt: ts,
        publicRef: 'a1b2c3d4',
        secretHash: 'f'.repeat(64),
        correlationId: '11111111-1111-4111-8111-111111111111',
        payload: { reportType: 'flood' },
      }),
    ).toThrow()
  })
})

describe('hazardTagSchema', () => {
  it('accepts a hazard tag', () => {
    expect(
      hazardTagSchema.parse({
        hazardZoneId: 'hz-1',
        geohash: 'qxdsun',
        hazardType: 'flood',
      }),
    ).toMatchObject({ geohash: 'qxdsun' })
  })

  it('rejects invalid hazardType', () => {
    expect(() =>
      hazardTagSchema.parse({
        hazardZoneId: 'hz-1',
        geohash: 'qxdsun',
        hazardType: 'fire',
      }),
    ).toThrow()
  })
})

describe('reportDocSchema Phase 3 deltas', () => {
  const validBase = {
    municipalityId: 'daet',
    municipalityLabel: 'Daet',
    barangayId: 'daet-1',
    reporterRole: 'citizen' as const,
    reportType: 'flood' as const,
    severity: 'high' as const,
    status: 'new' as const,
    publicLocation: { lat: 14.1, lng: 122.9 },
    mediaRefs: [],
    description: 'flooded road',
    submittedAt: 1713350400000,
    retentionExempt: false,
    visibilityClass: 'internal' as const,
    visibility: { scope: 'municipality' as const, sharedWith: [] },
    source: 'web' as const,
    hasPhotoAndGPS: false,
    schemaVersion: 1,
    correlationId: '11111111-1111-4111-8111-111111111111',
  }

  it('accepts a valid report with municipalityLabel and correlationId', () => {
    expect(() => reportDocSchema.parse(validBase)).not.toThrow()
  })

  it('rejects a missing municipalityLabel', () => {
    const { municipalityLabel, ...rest } = validBase
    void municipalityLabel
    expect(() => reportDocSchema.parse(rest)).toThrow()
  })

  it('rejects a non-UUID correlationId', () => {
    expect(() => reportDocSchema.parse({ ...validBase, correlationId: 'not-a-uuid' })).toThrow()
  })

  it('rejects an empty municipalityLabel', () => {
    expect(() => reportDocSchema.parse({ ...validBase, municipalityLabel: '' })).toThrow()
  })
})

describe('reportLookupDocSchema Phase 3 deltas', () => {
  const valid = {
    publicTrackingRef: 'a1b2c3d4',
    reportId: 'rpt-1',
    tokenHash: 'a'.repeat(64),
    expiresAt: 1716000000000,
    createdAt: 1713350400000,
    schemaVersion: 1,
  }

  it('accepts a lookup with tokenHash and expiresAt', () => {
    expect(() => reportLookupDocSchema.parse(valid)).not.toThrow()
  })

  it('rejects a non-hex tokenHash', () => {
    expect(() => reportLookupDocSchema.parse({ ...valid, tokenHash: 'z'.repeat(64) })).toThrow()
  })
})

describe('reportInboxDocSchema Phase 3 deltas', () => {
  const validInbox = {
    reporterUid: 'citizen-1',
    clientCreatedAt: 1713350400000,
    idempotencyKey: 'idem-1',
    publicRef: 'a1b2c3d4',
    secretHash: 'f'.repeat(64),
    correlationId: '11111111-1111-4111-8111-111111111111',
    payload: { reportType: 'flood', description: 'x' },
  }

  it('accepts a valid inbox doc with all Phase 3 fields', () => {
    expect(() => reportInboxDocSchema.parse(validInbox)).not.toThrow()
  })

  it('rejects a publicRef with uppercase letters', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, publicRef: 'A1B2C3D4' })).toThrow()
  })

  it('rejects a publicRef of wrong length', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, publicRef: 'abc' })).toThrow()
  })

  it('rejects a secretHash that is not 64 hex chars', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, secretHash: 'short' })).toThrow()
  })

  it('rejects a non-UUID correlationId', () => {
    expect(() => reportInboxDocSchema.parse({ ...validInbox, correlationId: 'x' })).toThrow()
  })
})

describe('inboxPayloadSchema contact extension', () => {
  const basePayload = {
    reportType: 'flood',
    description: 'test',
    severity: 'medium' as const,
    source: 'web' as const,
    publicLocation: { lat: 14.6, lng: 121.0 },
  }

  it('accepts payload without contact (existing behavior preserved)', () => {
    expect(() => inboxPayloadSchema.parse(basePayload)).not.toThrow()
  })

  it('accepts contact with smsConsent=true', () => {
    expect(() =>
      inboxPayloadSchema.parse({
        ...basePayload,
        contact: { phone: '+639171234567', smsConsent: true },
      }),
    ).not.toThrow()
  })

  it('rejects contact with smsConsent=false (consent must be literal true)', () => {
    expect(() =>
      inboxPayloadSchema.parse({
        ...basePayload,
        contact: { phone: '+639171234567', smsConsent: false },
      }),
    ).toThrow()
  })

  it('rejects contact with non-normalized phone', () => {
    expect(() =>
      inboxPayloadSchema.parse({
        ...basePayload,
        contact: { phone: '09171234567', smsConsent: true },
      }),
    ).toThrow()
  })

  it('rejects contact with extra fields (strict)', () => {
    expect(() =>
      inboxPayloadSchema.parse({
        ...basePayload,
        contact: { phone: '+639171234567', smsConsent: true, extra: 'field' },
      }),
    ).toThrow()
  })
})
