import { describe, it, expect } from 'vitest'
import { REPORT_TYPE_LABEL, RESPONDER_TYPE_LABEL, getReportTypeLabel, getResponderTypeLabel } from './incident-labels'

describe('incident-labels', () => {
  it('exposes a REPORT_TYPE_LABEL map covering all known disaster types', () => {
    expect(REPORT_TYPE_LABEL.flood).toMatch(/Flood/)
    expect(REPORT_TYPE_LABEL.fire).toMatch(/Fire/)
    expect(REPORT_TYPE_LABEL.earthquake).toMatch(/Earthquake/)
    expect(REPORT_TYPE_LABEL.medical).toMatch(/Medical/)
    expect(REPORT_TYPE_LABEL.other).toMatch(/Other/)
  })

  it('exposes a RESPONDER_TYPE_LABEL map for known responder roles (legacy string keys)', () => {
    expect(RESPONDER_TYPE_LABEL.fire).toBeTruthy()
    expect(RESPONDER_TYPE_LABEL.medical).toBeTruthy()
    expect(RESPONDER_TYPE_LABEL.general).toBeTruthy()
  })

  it('getReportTypeLabel returns the known label for a recognised type', () => {
    expect(getReportTypeLabel('flood')).toBe(REPORT_TYPE_LABEL.flood)
  })

  it('getReportTypeLabel returns the raw type for an unrecognised type (forward-compat)', () => {
    expect(getReportTypeLabel('asteroid_strike')).toBe('asteroid_strike')
  })

  it('getReportTypeLabel returns the "other" label for undefined input', () => {
    expect(getReportTypeLabel(undefined)).toBe(REPORT_TYPE_LABEL.other)
  })

  describe('getResponderTypeLabel — spec code keys (POL/FIR/MED/ENG/SAR/SW/GEN)', () => {
    it('returns Police Officer for POL', () => {
      expect(getResponderTypeLabel('POL')).toBe('Police Officer')
    })

    it('returns Firefighter for FIR', () => {
      expect(getResponderTypeLabel('FIR')).toBe('Firefighter')
    })

    it('returns Medical/Paramedic for MED', () => {
      expect(getResponderTypeLabel('MED')).toBe('Medical/Paramedic')
    })

    it('returns Engineer/SAR Technical for ENG', () => {
      expect(getResponderTypeLabel('ENG')).toBe('Engineer/Search & Rescue Technical')
    })

    it('returns Search and Rescue for SAR', () => {
      expect(getResponderTypeLabel('SAR')).toBe('Search and Rescue')
    })

    it('returns Social Worker for SW', () => {
      expect(getResponderTypeLabel('SW')).toBe('Social Worker')
    })

    it('returns General Responder for GEN', () => {
      expect(getResponderTypeLabel('GEN')).toBe('General Responder')
    })

    it('returns General Responder for unknown type', () => {
      expect(getResponderTypeLabel('UNKNOWN')).toBe('General Responder')
    })

    it('returns General Responder when type is undefined', () => {
      expect(getResponderTypeLabel(undefined)).toBe('General Responder')
    })
  })
})
