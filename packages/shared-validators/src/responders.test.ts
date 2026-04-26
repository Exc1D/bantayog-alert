import { describe, expect, it } from 'vitest'
import { responderDocSchema } from './responders'

const ts = 1713350400000

describe('responderDocSchema PRE-B deltas', () => {
  it('accepts hasFcmToken and fcmTokens fields', () => {
    const result = responderDocSchema.parse({
      uid: 'resp-1',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      displayCode: 'BFP-01',
      specialisations: [],
      availabilityStatus: 'available',
      isActive: true,
      schemaVersion: 1,
      createdAt: ts,
      updatedAt: ts,
      fcmTokens: ['token-abc'],
      hasFcmToken: true,
    })
    expect(result.hasFcmToken).toBe(true)
    expect(result.fcmTokens).toEqual(['token-abc'])
  })

  it('defaults hasFcmToken to false when absent', () => {
    const result = responderDocSchema.parse({
      uid: 'resp-1',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      displayCode: 'BFP-01',
      specialisations: [],
      availabilityStatus: 'available',
      isActive: true,
      schemaVersion: 1,
      createdAt: ts,
      updatedAt: ts,
    })
    expect(result.hasFcmToken).toBe(false)
    expect(result.fcmTokens).toEqual([])
  })

  it('preserves explicit hasFcmToken false even with fcmTokens present', () => {
    const result = responderDocSchema.parse({
      uid: 'resp-1',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      displayCode: 'BFP-01',
      specialisations: [],
      availabilityStatus: 'available',
      isActive: true,
      schemaVersion: 1,
      createdAt: ts,
      updatedAt: ts,
      fcmTokens: ['token-abc'],
      hasFcmToken: false,
    })
    expect(result.hasFcmToken).toBe(false)
    expect(result.fcmTokens).toEqual(['token-abc'])
  })
})
