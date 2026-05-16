import { describe, it, expect } from 'vitest'
import { isAccountActive } from '../../callables/admin-auth.js'

describe('isAccountActive', () => {
  it('returns true for legacy active: true claim', () => {
    expect(isAccountActive({ active: true })).toBe(true)
  })

  it('returns true for new accountStatus: active claim', () => {
    expect(isAccountActive({ accountStatus: 'active' })).toBe(true)
  })

  it('returns false when neither claim is present', () => {
    expect(isAccountActive({})).toBe(false)
  })

  it('returns false for inactive accountStatus', () => {
    expect(isAccountActive({ accountStatus: 'suspended' })).toBe(false)
  })

  it('prefers accountStatus over legacy active when both present', () => {
    expect(isAccountActive({ active: true, accountStatus: 'suspended' })).toBe(false)
  })

  it('returns false for non-boolean active values', () => {
    expect(isAccountActive({ active: 'true' })).toBe(false)
    expect(isAccountActive({ active: 1 })).toBe(false)
  })
})
