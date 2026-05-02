import { describe, it, expect } from 'vitest'
import { isQuotaExceededError, isSecurityError } from './storage-errors.js'

describe('isQuotaExceededError', () => {
  it('returns true for QuotaExceededError by name', () => {
    const err = new DOMException('quota', 'QuotaExceededError')
    expect(isQuotaExceededError(err)).toBe(true)
  })

  it('returns true for DOMException with code 22', () => {
    const err = new DOMException('quota')
    Object.defineProperty(err, 'code', { value: 22 })
    expect(isQuotaExceededError(err)).toBe(true)
  })

  it('returns false for wrong DOMException', () => {
    const err = new DOMException('oops', 'NotFoundError')
    expect(isQuotaExceededError(err)).toBe(false)
  })

  it('returns false for regular Error', () => {
    expect(isQuotaExceededError(new Error('fail'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isQuotaExceededError(null)).toBe(false)
  })

  it('returns false for string', () => {
    expect(isQuotaExceededError('QuotaExceededError')).toBe(false)
  })
})

describe('isSecurityError', () => {
  it('returns true for SecurityError', () => {
    const err = new DOMException('blocked', 'SecurityError')
    expect(isSecurityError(err)).toBe(true)
  })

  it('returns false for wrong DOMException', () => {
    const err = new DOMException('oops', 'NotFoundError')
    expect(isSecurityError(err)).toBe(false)
  })

  it('returns false for regular Error', () => {
    expect(isSecurityError(new Error('fail'))).toBe(false)
  })

  it('returns false for null', () => {
    expect(isSecurityError(null)).toBe(false)
  })

  it('returns false for string', () => {
    expect(isSecurityError('SecurityError')).toBe(false)
  })
})
