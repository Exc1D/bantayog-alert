import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateIdempotencyKey } from '../generateIdempotencyKey'

describe('generateIdempotencyKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses crypto.randomUUID when available', () => {
    const mockRandomUUID = vi.fn().mockReturnValue('mock-uuid-v4')
    vi.stubGlobal('crypto', { randomUUID: mockRandomUUID })

    const result = generateIdempotencyKey()

    expect(result).toBe('mock-uuid-v4')
    expect(mockRandomUUID).toHaveBeenCalledTimes(1)
  })

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    const mockGetRandomValues = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i
      return arr
    })
    vi.stubGlobal('crypto', { getRandomValues: mockGetRandomValues, randomUUID: undefined })

    const result = generateIdempotencyKey()

    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(mockGetRandomValues).toHaveBeenCalledTimes(1)
  })

  it('falls back to timestamp + counter when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)

    const key1 = generateIdempotencyKey()
    const key2 = generateIdempotencyKey()

    expect(key1).not.toBe(key2)
    expect(key1).toMatch(/^[0-9a-f]+-[0-9a-f]+-[0-9a-f]+$/)
  })

  it('generates unique keys in fallback mode', () => {
    vi.stubGlobal('crypto', undefined)

    const keys = new Set<string>()
    for (let i = 0; i < 100; i++) {
      keys.add(generateIdempotencyKey())
    }

    expect(keys.size).toBe(100)
  })
})
