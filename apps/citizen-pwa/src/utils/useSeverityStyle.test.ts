import { describe, it, expect } from 'vitest'
import { getSeverityStyle } from './useSeverityStyle.js'

describe('getSeverityStyle', () => {
  it('returns correct tokens for high severity', () => {
    const result = getSeverityStyle('high')
    expect(result.fg).toBe('var(--color-severity-high-fg)')
    expect(result.bg).toBe('var(--color-severity-high-bg)')
    expect(result.label).toBe('HIGH')
  })

  it('returns correct tokens for medium severity', () => {
    const result = getSeverityStyle('medium')
    expect(result.fg).toBe('var(--color-severity-medium-fg)')
    expect(result.bg).toBe('var(--color-severity-medium-bg)')
    expect(result.label).toBe('MEDIUM')
  })

  it('returns correct tokens for low severity', () => {
    const result = getSeverityStyle('low')
    expect(result.fg).toBe('var(--color-severity-low-fg)')
    expect(result.bg).toBe('var(--color-severity-low-bg)')
    expect(result.label).toBe('LOW')
  })

  it('returns fallback for unknown severity', () => {
    const result = getSeverityStyle('unknown')
    expect(result.fg).toBe('var(--color-severity-low-fg)')
    expect(result.bg).toBe('var(--color-severity-low-bg)')
    expect(result.label).toBe('INFO')
  })

  it('returns dot color as raw hex for leaflet markers', () => {
    expect(getSeverityStyle('high').dotHex).toBe('#dc2626')
    expect(getSeverityStyle('medium').dotHex).toBe('#a73400')
    expect(getSeverityStyle('low').dotHex).toBe('#414849')
  })
})
