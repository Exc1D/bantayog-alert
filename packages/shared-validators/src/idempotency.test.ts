import { describe, it, expect } from 'vitest'
import { canonicalPayloadHash } from './idempotency.js'

describe('canonicalPayloadHash', () => {
  it('produces a 64-char hex SHA-256 digest', () => {
    const hash = canonicalPayloadHash({ a: 1 })
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns the same hash for the same input', () => {
    const a = canonicalPayloadHash({ reportId: 'r1', source: 'web' })
    const b = canonicalPayloadHash({ reportId: 'r1', source: 'web' })
    expect(a).toBe(b)
  })

  it('is invariant under key order', () => {
    const a = canonicalPayloadHash({ x: 1, y: 2, z: 3 })
    const b = canonicalPayloadHash({ z: 3, y: 2, x: 1 })
    const c = canonicalPayloadHash({ y: 2, x: 1, z: 3 })
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('sorts keys at every nesting level', () => {
    const a = canonicalPayloadHash({ outer: { b: 2, a: 1 } })
    const b = canonicalPayloadHash({ outer: { a: 1, b: 2 } })
    expect(a).toBe(b)
  })

  it('produces different hashes for different values', () => {
    const a = canonicalPayloadHash({ v: 1 })
    const b = canonicalPayloadHash({ v: 2 })
    expect(a).not.toBe(b)
  })

  it('handles arrays without sorting their elements (order matters)', () => {
    const a = canonicalPayloadHash({ list: [1, 2, 3] })
    const b = canonicalPayloadHash({ list: [3, 2, 1] })
    expect(a).not.toBe(b)
  })

  it('handles nested structures with arrays and objects', () => {
    const payload = {
      reportId: 'r1',
      location: { lat: 14.1, lng: 122.9 },
      tags: ['flood', 'urgent'],
    }
    const hash = canonicalPayloadHash(payload)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('treats null and undefined distinctly', () => {
    const a = canonicalPayloadHash({ v: null })
    // JSON.stringify drops undefined keys entirely, so the canonical form
    // of { v: undefined } is `{}`. Document and assert this behavior.
    const b = canonicalPayloadHash({ v: undefined })
    const c = canonicalPayloadHash({})
    expect(a).not.toBe(b)
    expect(b).toBe(c)
  })

  it('throws TypeError for Map, Set, and RegExp', () => {
    for (const exotic of [new Map(), new Set(), /pattern/] as const) {
      expect(() => canonicalPayloadHash({ data: exotic })).toThrow(TypeError)
    }
  })
})
