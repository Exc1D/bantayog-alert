import { describe, it, expect } from 'vitest'
import { parseSmsReport } from '../parser'

describe('parseSmsReport', () => {
  it('should parse BANTAYOG FLOOD CALASGASAN', () => {
    const result = parseSmsReport('BANTAYOG FLOOD CALASGASAN')
    expect(result).toEqual({
      success: true,
      type: 'flood',
      barangay: 'calasgasan',
      originalType: 'FLOOD',
      originalBarangay: 'CALASGASAN',
    })
  })

  it('should parse Tagalog synonym BAHA', () => {
    const result = parseSmsReport('BANTAYOG BAHA CALASGASAN')
    expect(result).toEqual({
      success: true,
      type: 'flood',
      barangay: 'calasgasan',
      originalType: 'BAHA',
      originalBarangay: 'CALASGASAN',
    })
  })

  it('should parse SUNOG (fire)', () => {
    const result = parseSmsReport('BANTAYOG SUNOG LAG-ON')
    expect(result).toEqual({
      success: true,
      type: 'fire',
      barangay: 'lag-on',
      originalType: 'SUNOG',
      originalBarangay: 'LAG-ON',
    })
  })

  it('should be case-insensitive', () => {
    const result = parseSmsReport('bantayog flood calasgasan')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.type).toBe('flood')
    }
  })

  it('should fail on missing keyword', () => {
    const result = parseSmsReport('FLOOD CALASGASAN')
    expect(result.success).toBe(false)
  })

  it('should fail on unknown type', () => {
    const result = parseSmsReport('BANTAYOG TORNADO CALASGASAN')
    expect(result.success).toBe(false)
  })

  it('should fail on missing barangay', () => {
    const result = parseSmsReport('BANTAYOG FLOOD')
    expect(result.success).toBe(false)
  })
})
