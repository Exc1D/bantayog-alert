import { describe, it, expect } from 'vitest'
import { toMillis } from './to-millis'

describe('toMillis', () => {
  it('returns the number as-is for numeric input', () => {
    expect(toMillis(1715000000000)).toBe(1715000000000)
    expect(toMillis(0)).toBe(0)
  })

  it('extracts millis from a Timestamp-like object', () => {
    const ts = { toMillis: () => 1715000000000 }
    expect(toMillis(ts)).toBe(1715000000000)
  })

  it('returns undefined for null', () => {
    expect(toMillis(null)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(toMillis(undefined)).toBeUndefined()
  })

  it('returns undefined for string input', () => {
    expect(toMillis('1715000000000')).toBeUndefined()
  })

  it('returns undefined for plain objects without toMillis', () => {
    expect(toMillis({ seconds: 1715000, nanoseconds: 0 })).toBeUndefined()
  })

  it('returns undefined when toMillis is present but not a function', () => {
    expect(toMillis({ toMillis: 'not-a-function' })).toBeUndefined()
  })
})
