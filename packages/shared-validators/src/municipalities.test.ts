import { describe, it, expect } from 'vitest'
import {
  municipalityDocSchema,
  updateMunicipalityContactInputSchema,
  mdrrmoHotlineSchema,
  CAMARINES_NORTE_MUNICIPALITIES,
} from './municipalities.js'

const VALID_INPUT = {
  municipalityId: 'daet',
  mdrrmoLabel: 'Daet MDRRMO',
  mdrrmoHotline: '(054) 721-1216',
}

describe('updateMunicipalityContactInputSchema', () => {
  it('accepts a valid payload', () => {
    expect(updateMunicipalityContactInputSchema.safeParse(VALID_INPUT).success).toBe(true)
  })

  it('accepts an international-format hotline', () => {
    const result = updateMunicipalityContactInputSchema.safeParse({
      ...VALID_INPUT,
      mdrrmoHotline: '+63 917 555 1234',
    })
    expect(result.success).toBe(true)
  })

  it('accepts every seeded Camarines Norte municipality id', () => {
    for (const m of CAMARINES_NORTE_MUNICIPALITIES) {
      const result = updateMunicipalityContactInputSchema.safeParse({
        ...VALID_INPUT,
        municipalityId: m.id,
      })
      expect(result.success, `expected ${m.id} to be accepted`).toBe(true)
    }
  })

  it('rejects an unknown municipality id', () => {
    const result = updateMunicipalityContactInputSchema.safeParse({
      ...VALID_INPUT,
      municipalityId: 'manila',
    })
    expect(result.success).toBe(false)
  })

  it('rejects malformed hotlines', () => {
    for (const hotline of ['', 'call us', '12345', 'abc-def-ghij', '(054) 721-1216 ext 9x']) {
      const result = updateMunicipalityContactInputSchema.safeParse({
        ...VALID_INPUT,
        mdrrmoHotline: hotline,
      })
      expect(result.success, `expected hotline ${JSON.stringify(hotline)} to be rejected`).toBe(
        false,
      )
    }
  })

  it('rejects empty and oversized labels', () => {
    for (const label of ['', 'x'.repeat(81)]) {
      const result = updateMunicipalityContactInputSchema.safeParse({
        ...VALID_INPUT,
        mdrrmoLabel: label,
      })
      expect(result.success).toBe(false)
    }
  })

  it('rejects missing fields and unknown keys', () => {
    expect(updateMunicipalityContactInputSchema.safeParse({ municipalityId: 'daet' }).success).toBe(
      false,
    )
    expect(
      updateMunicipalityContactInputSchema.safeParse({ ...VALID_INPUT, extra: true }).success,
    ).toBe(false)
  })
})

describe('mdrrmoHotlineSchema', () => {
  it('matches the optional hotline field on municipalityDocSchema', () => {
    expect(mdrrmoHotlineSchema.safeParse('(054) 721-1216').success).toBe(true)
    expect(mdrrmoHotlineSchema.safeParse('not a number').success).toBe(false)
  })
})

describe('municipalityDocSchema contact audit fields', () => {
  it('accepts docs carrying contactUpdatedAt/contactUpdatedBy after a hotline edit', () => {
    const result = municipalityDocSchema.safeParse({
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1121, lng: 122.9554 },
      mdrrmoLabel: 'Daet MDRRMO',
      mdrrmoHotline: '(054) 721-1216',
      contactUpdatedAt: 1765000000000,
      contactUpdatedBy: 'admin-1',
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })

  it('still accepts legacy docs without contact fields', () => {
    const result = municipalityDocSchema.safeParse({
      id: 'basud',
      label: 'Basud',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.0661, lng: 122.9561 },
      schemaVersion: 1,
    })
    expect(result.success).toBe(true)
  })
})
