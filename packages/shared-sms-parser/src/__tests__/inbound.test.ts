// @ts-nocheck - Types from inbound.js which doesn't exist yet (created in Task 2)
import { describe, it, expect } from 'vitest'
import { parseInboundSms } from '../inbound.js'

describe('parseInboundSms', () => {
  it('parses high-confidence flood report', () => {
    const result = parseInboundSms('BANTAYOG FLOOD CALASGASAN')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('flood')
    expect(result.parsed?.barangay).toBe('Calasgasan')
    expect(result.parsed?.rawBarangay).toBeUndefined()
    expect(result.candidates).toHaveLength(0)
  })

  it('parses with type synonym BAHA', () => {
    const result = parseInboundSms('BANTAYOG BAHA LABO')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('flood')
  })

  it('fuzzy-matches barangay with typo (Levenshtein ≤ 2)', () => {
    const result = parseInboundSms('BANTAYOG FIRE CALASGAN') // missing 's'
    expect(result.confidence).toBe('low')
    expect(result.parsed?.reportType).toBe('fire')
    expect(result.parsed?.barangay).toBe('Calasgasan')
    expect(result.parsed?.rawBarangay).toBe('CALASGAN')
    expect(result.candidates).toHaveLength(0)
  })

  it('returns candidates on ambiguous barangay match', () => {
    const result = parseInboundSms('BANTAYOG FLOOD DA')
    expect(result.confidence).toBe('low')
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.parsed).toBeNull()
  })

  it('returns confidence none for unparseable input', () => {
    const result = parseInboundSms('BANTAYOG HELP ME')
    expect(result.confidence).toBe('none')
    expect(result.parsed).toBeNull()
    expect(result.autoReplyText).toContain('BANTAYOG <TYPE> <BARANGAY>')
  })

  it('trims and normalizes whitespace', () => {
    const result = parseInboundSms('  BANTAYOG  FLOOD   CALASGASAN  ')
    expect(result.confidence).toBe('high')
  })

  it('is case-insensitive', () => {
    const result = parseInboundSms('bantayog flood Calasgasan')
    expect(result.confidence).toBe('high')
  })

  it('parses fire synonym SUNOG', () => {
    const result = parseInboundSms('BANTAYOG SUNOG SAN JOSE')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('fire')
  })

  it('parses landslide synonym GUHO', () => {
    const result = parseInboundSms('BANTAYOG GUHO MANGCAMAMUND')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('landslide')
  })

  it('parses medical synonym MEDIKAL', () => {
    const result = parseInboundSms('BANTAYOG MEDIKAL ALCOY')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('medical')
  })

  it('parses accident synonym AKSIDENTE', () => {
    const result = parseInboundSms('BANTAYOG AKSIDENTE BABANG')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('accident')
  })

  it('captures details after barangay', () => {
    const result = parseInboundSms('BANTAYOG FLOOD CALASGASAN Mabait naman')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.details).toBe('Mabait naman')
  })

  it('returns high confidence for OTHER type', () => {
    const result = parseInboundSms('BANTAYOG OTHER NAMNAMA')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('other')
  })
})