import { describe, expect, it } from 'vitest'
import { userDocSchema } from './users'
import type { UserDoc } from './users'

const ts = 1713350400000

describe('userDocSchema', () => {
  it('parses a canonical user doc', () => {
    const result: UserDoc = userDocSchema.parse({
      uid: 'user-1',
      role: 'citizen',
      displayName: 'Juan Dela Cruz',
      phone: '+63 912 345 6789',
      barangayId: 'barangay-1',
      municipalityId: 'daet',
      isPseudonymous: false,
      followUpConsent: true,
      schemaVersion: 1,
      createdAt: ts,
      updatedAt: ts,
    })

    expect(result).toMatchObject({
      uid: 'user-1',
      role: 'citizen',
      followUpConsent: true,
    })
  })

  it('defaults followUpConsent to false', () => {
    const result = userDocSchema.parse({
      uid: 'user-1',
      role: 'citizen',
      isPseudonymous: false,
      createdAt: ts,
      updatedAt: ts,
      schemaVersion: 1,
    })

    expect(result.followUpConsent).toBe(false)
  })

  it('rejects unknown keys via strict mode', () => {
    expect(() =>
      userDocSchema.parse({
        uid: 'user-1',
        role: 'citizen',
        isPseudonymous: false,
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
        unknownField: true,
      }),
    ).toThrow()
  })
})
