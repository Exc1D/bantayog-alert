import { describe, expect, it } from 'vitest'
import { responderDocSchema } from './responders'

const ts = 1713350400000

describe('responderDocSchema PRE-B deltas', () => {
  it('accepts hasFcmToken and fcmTokens fields', () => {
    expect(
      responderDocSchema.parse({
        uid: 'resp-1',
        agencyId: 'bfp-daet',
        municipalityId: 'daet',
        displayCode: 'BFP-01',
        specialisations: [],
        availabilityStatus: 'on_duty',
        isActive: true,
        schemaVersion: 1,
        createdAt: ts,
        updatedAt: ts,
        fcmTokens: ['token-abc'],
        hasFcmToken: true,
      }),
    ).toMatchObject({ hasFcmToken: true })
  })

  it('defaults hasFcmToken to false when absent', () => {
    const result = responderDocSchema.parse({
      uid: 'resp-1',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      displayCode: 'BFP-01',
      specialisations: [],
      availabilityStatus: 'on_duty',
      isActive: true,
      schemaVersion: 1,
      createdAt: ts,
      updatedAt: ts,
    })
    expect(result.hasFcmToken).toBe(false)
    expect(result.fcmTokens).toEqual([])
  })
})
