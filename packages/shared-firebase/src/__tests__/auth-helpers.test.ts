import { describe, it, expect } from 'vitest'
import { isPrivilegedRole, sessionTimeoutMs } from '../auth-helpers'

describe('isPrivilegedRole', () => {
  it('should return true for admin roles', () => {
    expect(isPrivilegedRole('municipal_admin')).toBe(true)
    expect(isPrivilegedRole('agency_admin')).toBe(true)
    expect(isPrivilegedRole('provincial_superadmin')).toBe(true)
  })

  it('should return true for responder', () => {
    expect(isPrivilegedRole('responder')).toBe(true)
  })

  it('should return false for citizen', () => {
    expect(isPrivilegedRole('citizen')).toBe(false)
  })
})

describe('sessionTimeoutMs', () => {
  it('should return 12h for responder', () => {
    expect(sessionTimeoutMs('responder')).toBe(12 * 60 * 60 * 1000)
  })

  it('should return 8h for municipal_admin', () => {
    expect(sessionTimeoutMs('municipal_admin')).toBe(8 * 60 * 60 * 1000)
  })

  it('should return 8h for agency_admin', () => {
    expect(sessionTimeoutMs('agency_admin')).toBe(8 * 60 * 60 * 1000)
  })

  it('should return 4h for provincial_superadmin', () => {
    expect(sessionTimeoutMs('provincial_superadmin')).toBe(4 * 60 * 60 * 1000)
  })

  it('should return Infinity for citizen (no session timeout)', () => {
    expect(sessionTimeoutMs('citizen')).toBe(Infinity)
  })
})
