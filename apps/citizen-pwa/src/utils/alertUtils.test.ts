import { describe, it, expect } from 'vitest'
import { severityMeta } from './alertUtils.js'

describe('severityMeta', () => {
  it('returns CRITICAL for critical', () => {
    expect(severityMeta('critical')).toEqual({
      label: 'CRITICAL',
      bg: '#fecaca',
      color: '#7f1d1d',
    })
  })

  it('returns HIGH for high', () => {
    expect(severityMeta('high')).toEqual({
      label: 'HIGH',
      bg: '#fee2e2',
      color: '#991b1b',
    })
  })

  it('returns MEDIUM for medium', () => {
    expect(severityMeta('medium')).toEqual({
      label: 'MEDIUM',
      bg: '#fff5ef',
      color: '#a73400',
    })
  })

  it('returns LOW for low', () => {
    expect(severityMeta('low')).toEqual({
      label: 'LOW',
      bg: '#e0e7f0',
      color: '#001e40',
    })
  })

  it('returns INFO for unknown severity', () => {
    expect(severityMeta('unknown')).toEqual({
      label: 'INFO',
      bg: '#dbeafe',
      color: '#1e40af',
    })
  })

  it('returns INFO for empty string', () => {
    expect(severityMeta('')).toEqual({
      label: 'INFO',
      bg: '#dbeafe',
      color: '#1e40af',
    })
  })
})
