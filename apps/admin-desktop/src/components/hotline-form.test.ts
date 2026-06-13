import { describe, it, expect } from 'vitest'
import { canEditHotlines, validateHotlineForm } from './hotline-form'

describe('canEditHotlines', () => {
  it('allows municipal_admin and provincial_superadmin', () => {
    expect(canEditHotlines({ role: 'municipal_admin', municipalityId: 'daet' })).toBe(true)
    expect(canEditHotlines({ role: 'provincial_superadmin' })).toBe(true)
  })

  it('denies other roles and missing claims', () => {
    expect(canEditHotlines({ role: 'agency_admin' })).toBe(false)
    expect(canEditHotlines({ role: 'responder' })).toBe(false)
    expect(canEditHotlines({ role: 'citizen' })).toBe(false)
    expect(canEditHotlines(null)).toBe(false)
    expect(canEditHotlines({})).toBe(false)
  })
})

describe('validateHotlineForm', () => {
  it('accepts a valid label and hotline', () => {
    expect(
      validateHotlineForm({ mdrrmoLabel: 'Daet MDRRMO', mdrrmoHotline: '(054) 721-1216' }),
    ).toEqual({})
  })

  it('accepts an international-format hotline', () => {
    expect(
      validateHotlineForm({ mdrrmoLabel: 'Daet MDRRMO', mdrrmoHotline: '+63 917 555 1234' }),
    ).toEqual({})
  })

  it('flags an empty label', () => {
    const errors = validateHotlineForm({ mdrrmoLabel: '   ', mdrrmoHotline: '(054) 721-1216' })
    expect(errors.mdrrmoLabel).toBeTruthy()
  })

  it('flags a malformed hotline', () => {
    for (const hotline of ['', 'call us', '12345', 'abc-def']) {
      const errors = validateHotlineForm({ mdrrmoLabel: 'Daet MDRRMO', mdrrmoHotline: hotline })
      expect(errors.mdrrmoHotline, `expected ${JSON.stringify(hotline)} to be flagged`).toBeTruthy()
    }
  })
})
