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
} from './reports.js'

const ts = 1713350400000

describe('reportDocSchema', () => {
  it('accepts a canonical verified report', () => {
    expect(
      reportDocSchema.parse({
        municipalityId: 'daet',
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
      }),
    ).toMatchObject({ status: 'verified' })
  })

  it('rejects an invalid status literal', () => {
    expect(() =>
      reportDocSchema.parse({
        municipalityId: 'daet',
        reporterRole: 'citizen',
        reportType: 'flood',
        severity: 'high',
        status: 'triaged', // not a valid ReportStatus
        mediaRefs: [],
        description: 'x',
        submittedAt: ts,
        retentionExempt: false,
        visibilityClass: 'internal',
        visibility: { scope: 'municipality', sharedWith: [] },
        source: 'web',
        hasPhotoAndGPS: false,
        schemaVersion: 1,
      }),
    ).toThrow()
  })

  it('rejects unknown top-level keys via strict mode', () => {
    expect(() =>
      reportDocSchema.parse({
        municipalityId: 'daet',
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
        unknownField: 'oops', // should be rejected
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
        sharedWith: 'mercedes', // should be array
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
        publicTrackingRef: 'TRK-ABC-123',
        reportId: 'r-1',
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toMatchObject({ publicTrackingRef: 'TRK-ABC-123' })
  })
})

describe('reportInboxDocSchema', () => {
  it('accepts an inbox item', () => {
    expect(
      reportInboxDocSchema.parse({
        reporterUid: 'uid-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k1',
        payload: { reportType: 'flood', description: 'x', source: 'web' },
      }),
    ).toMatchObject({ reporterUid: 'uid-1' })
  })

  it('rejects missing idempotencyKey', () => {
    expect(() =>
      reportInboxDocSchema.parse({
        reporterUid: 'uid-1',
        clientCreatedAt: ts,
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
        hazardType: 'fire', // not in HazardType enum
      }),
    ).toThrow()
  })
})
