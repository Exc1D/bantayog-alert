import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from './format-time'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the original value for unparseable strings', () => {
    expect(formatRelativeTime('not-a-date')).toBe('not-a-date')
  })

  it('returns the original value for empty string', () => {
    expect(formatRelativeTime('')).toBe('')
  })

  it('returns "Ns ago" for seconds', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-16T10:00:00Z').getTime())
    expect(formatRelativeTime('2026-05-16T09:59:50Z')).toBe('10s ago')
  })

  it('returns "Nm ago" for minutes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-16T10:05:00Z').getTime())
    expect(formatRelativeTime('2026-05-16T10:00:00Z')).toBe('5m ago')
  })

  it('returns "Nh ago" for hours', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-16T14:00:00Z').getTime())
    expect(formatRelativeTime('2026-05-16T10:00:00Z')).toBe('4h ago')
  })

  it('returns "Nd ago" for days', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-18T10:00:00Z').getTime())
    expect(formatRelativeTime('2026-05-16T10:00:00Z')).toBe('2d ago')
  })

  it('returns "0s ago" with 0-second difference', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-16T10:00:00Z').getTime())
    expect(formatRelativeTime('2026-05-16T10:00:00Z')).toBe('0s ago')
  })
})
