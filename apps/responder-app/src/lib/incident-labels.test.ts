import { describe, it, expect } from 'vitest'
import { REPORT_TYPE_LABEL, RESPONDER_TYPE_LABEL, reportTypeLabel } from './incident-labels'

describe('incident-labels', () => {
  it('exposes a REPORT_TYPE_LABEL map covering all known disaster types', () => {
    expect(REPORT_TYPE_LABEL.flood).toMatch(/Flood/)
    expect(REPORT_TYPE_LABEL.fire).toMatch(/Fire/)
    expect(REPORT_TYPE_LABEL.earthquake).toMatch(/Earthquake/)
    expect(REPORT_TYPE_LABEL.medical).toMatch(/Medical/)
    expect(REPORT_TYPE_LABEL.other).toMatch(/Other/)
  })

  it('exposes a RESPONDER_TYPE_LABEL map for known responder roles', () => {
    expect(RESPONDER_TYPE_LABEL.fire).toBe('Fire')
    expect(RESPONDER_TYPE_LABEL.medical).toBe('Medical')
    expect(RESPONDER_TYPE_LABEL.general).toBe('General')
  })

  it('reportTypeLabel returns the known label for a recognised type', () => {
    expect(reportTypeLabel('flood')).toBe(REPORT_TYPE_LABEL.flood)
  })

  it('reportTypeLabel returns the raw type for an unrecognised type (forward-compat)', () => {
    expect(reportTypeLabel('asteroid_strike')).toBe('asteroid_strike')
  })

  it('reportTypeLabel returns the "other" label for undefined input', () => {
    expect(reportTypeLabel(undefined)).toBe(REPORT_TYPE_LABEL.other)
  })
})
