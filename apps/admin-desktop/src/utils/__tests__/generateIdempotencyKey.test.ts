import { describe, it, expect } from 'vitest'
import { generateIdempotencyKey } from '../generateIdempotencyKey'

describe('generateIdempotencyKey', () => {
  it('returns a v4 UUID', () => {
    expect(generateIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()))
    expect(keys.size).toBe(100)
  })
})
