import { describe, it, expect } from 'vitest'
import { severityMeta } from './alertUtils.js'

describe('severityMeta', () => {
  it('returns CRITICAL for critical', () => {
    expect(severityMeta('critical')).toEqual({
      label: 'CRITICAL',
      bg: 'var(--color-severity-critical-bg)',
      color: 'var(--color-severity-critical-fg)',
    })
  })

  it('returns HIGH for high', () => {
    expect(severityMeta('high')).toEqual({
      label: 'HIGH',
      bg: 'var(--color-severity-high-bg)',
      color: 'var(--color-severity-high-fg)',
    })
  })

  it('returns MEDIUM for medium', () => {
    expect(severityMeta('medium')).toEqual({
      label: 'MEDIUM',
      bg: 'var(--color-severity-medium-bg)',
      color: 'var(--color-severity-medium-fg)',
    })
  })

  it('returns LOW for low', () => {
    expect(severityMeta('low')).toEqual({
      label: 'LOW',
      bg: 'var(--color-severity-low-bg)',
      color: 'var(--color-severity-low-fg)',
    })
  })

  it('returns INFO for unknown severity', () => {
    expect(severityMeta('unknown')).toEqual({
      label: 'INFO',
      bg: 'var(--color-severity-low-bg)',
      color: 'var(--color-severity-low-fg)',
    })
  })

  it('returns INFO for empty string', () => {
    expect(severityMeta('')).toEqual({
      label: 'INFO',
      bg: 'var(--color-severity-low-bg)',
      color: 'var(--color-severity-low-fg)',
    })
  })
})
