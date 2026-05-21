import { describe, it, expect } from 'vitest'
import { getAdminCallableCorsOrigins } from '../callable-config.js'

describe('getAdminCallableCorsOrigins', () => {
  it('includes localhost dev origin', () => {
    const origins = getAdminCallableCorsOrigins()
    expect(origins).toContain('http://localhost:5175')
  })

  it('includes staging origin', () => {
    const origins = getAdminCallableCorsOrigins()
    expect(origins).toContain('https://bantayog-alert-staging.web.app')
  })

  it('includes production origin', () => {
    const origins = getAdminCallableCorsOrigins()
    expect(origins).toContain('https://bantayog-alert.web.app')
  })

  it('returns at least three origins', () => {
    const origins = getAdminCallableCorsOrigins()
    expect(origins.length).toBeGreaterThanOrEqual(3)
  })
})
