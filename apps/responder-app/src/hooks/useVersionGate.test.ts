import { describe, it, expect } from 'vitest'
import { semverLt } from '@bantayog/shared-validators'

describe('semverLt', () => {
  it('returns true when a is older than b', () => {
    expect(semverLt('0.9.0', '1.0.0')).toBe(true)
    expect(semverLt('1.0.0', '1.0.1')).toBe(true)
    expect(semverLt('0.0.0', '99.0.0')).toBe(true)
  })

  it('returns false when a equals b', () => {
    expect(semverLt('1.0.0', '1.0.0')).toBe(false)
  })

  it('returns false when a is newer than b', () => {
    expect(semverLt('2.0.0', '1.0.0')).toBe(false)
    expect(semverLt('1.1.0', '1.0.0')).toBe(false)
  })
})
