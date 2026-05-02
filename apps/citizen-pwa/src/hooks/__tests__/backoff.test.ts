import { describe, it, expect } from 'vitest'
import { backoffDelay } from '../useSubmissionMachine.js'

describe('backoffDelay', () => {
  it('returns 2s for the first attempt', () => {
    expect(backoffDelay(0)).toBe(2_000)
  })

  it('doubles each retry: 4s, 8s, 16s', () => {
    expect(backoffDelay(1)).toBe(4_000)
    expect(backoffDelay(2)).toBe(8_000)
    expect(backoffDelay(3)).toBe(16_000)
  })

  it('caps at 30s for high retry counts', () => {
    expect(backoffDelay(10)).toBe(30_000)
    expect(backoffDelay(50)).toBe(30_000)
  })
})
