import { describe, it, expect } from 'vitest'
import { formatDateTime } from './format-date.js'

describe('formatDateTime', () => {
  it('formats date with en-PH locale and Asia/Manila timezone', () => {
    const date = new Date('2026-05-04T08:30:00.000Z')
    const result = formatDateTime(date)
    expect(result).toContain('2026')
    expect(result).toMatch(/PM|AM/)
  })

  it('handles timestamp numbers', () => {
    const ts = Date.UTC(2026, 4, 4, 8, 30, 0)
    const result = formatDateTime(ts)
    expect(result).toContain('2026')
  })
})
