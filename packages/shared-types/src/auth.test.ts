import { describe, expect, it } from 'vitest'
import type { CustomClaims } from './auth.js'

describe('CustomClaims', () => {
  type BreakGlassClaimRemoved = 'breakGlassSession' extends keyof CustomClaims ? false : true
  const breakGlassClaimRemoved: BreakGlassClaimRemoved = true

  it('does not retain the retired break-glass claim', () => {
    expect(breakGlassClaimRemoved).toBe(true)
  })
})
