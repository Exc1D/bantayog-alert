import { describe, it, expect } from 'vitest'
import {
  BantayogErrorCode,
  isBantayogErrorCode,
  isTerminalReportStatus,
  isTerminalDispatchStatus,
} from './errors.js'
import type { ReportStatus, DispatchStatus } from './errors.js'
import { logEvent, LOG_DIMENSION_MAX } from './logging.js'

// ─── BantayogErrorCode enum ────────────────────────────────────────────────

describe('BantayogErrorCode', () => {
  it('has 19 named error codes', () => {
    const codes = Object.values(BantayogErrorCode)
    expect(codes).toHaveLength(19)
  })

  it('isBantayogErrorCode returns true for every enum member', () => {
    for (const code of Object.values(BantayogErrorCode)) {
      expect(isBantayogErrorCode(code), `${code} should be valid`).toBe(true)
    }
  })

  it('isBantayogCode returns false for unknown strings', () => {
    expect(isBantayogErrorCode('UNKNOWN_CODE')).toBe(false)
    expect(isBantayogErrorCode('')).toBe(false)
    expect(isBantayogErrorCode('validation_error')).toBe(false)
  })
})

// ─── Terminal status helpers ─────────────────────────────────────────────────

describe('isTerminalReportStatus', () => {
  it('returns true for closed and resolved', () => {
    expect(isTerminalReportStatus('closed')).toBe(true)
    expect(isTerminalReportStatus('resolved')).toBe(true)
  })

  it('returns false for all other report statuses', () => {
    const nonTerminal: ReportStatus[] = [
      'draft_inbox',
      'new',
      'awaiting_verify',
      'verified',
      'assigned',
      'acknowledged',
      'en_route',
      'on_scene',
      'reopened',
      'rejected',
      'cancelled',
      'cancelled_false_report',
      'merged_as_duplicate',
    ]
    for (const s of nonTerminal) {
      expect(isTerminalReportStatus(s), `${s} should not be terminal`).toBe(false)
    }
  })
})

describe('isTerminalDispatchStatus', () => {
  it('returns true for resolved and declined', () => {
    expect(isTerminalDispatchStatus('resolved')).toBe(true)
    expect(isTerminalDispatchStatus('declined')).toBe(true)
  })

  it('returns false for all other dispatch statuses', () => {
    const nonTerminal: DispatchStatus[] = [
      'pending',
      'accepted',
      'acknowledged',
      'in_progress',
      'timed_out',
      'cancelled',
      'superseded',
    ]
    for (const s of nonTerminal) {
      expect(isTerminalDispatchStatus(s), `${s} should not be terminal`).toBe(false)
    }
  })
})

// ─── logEvent dimension limits ───────────────────────────────────────────────

describe('LOG_DIMENSION_MAX', () => {
  it('is 128 characters', () => {
    expect(LOG_DIMENSION_MAX).toBe(128)
  })
})

// ─── logEvent structure ─────────────────────────────────────────────────────

describe('logEvent', () => {
  it('returns a structured plain object', () => {
    const event = logEvent({
      severity: 'INFO',
      code: BantayogErrorCode.VALIDATION_ERROR,
      message: 'Test event',
      dimension: 'test_dimension',
      data: { key: 'value' },
    })
    expect(event).toBeInstanceOf(Object)
    expect(event.timestamp).toBeDefined()
    expect(typeof event.timestamp).toBe('number')
    expect(event.severity).toBe('INFO')
    expect(event.code).toBe(BantayogErrorCode.VALIDATION_ERROR)
    expect(event.message).toBe('Test event')
    expect(event.dimension).toBe('test_dimension')
    expect(event.data).toEqual({ key: 'value' })
  })

  it('truncates dimension to 128 chars', () => {
    const longDimension = 'a'.repeat(200)
    const event = logEvent({
      severity: 'ERROR',
      code: BantayogErrorCode.INTERNAL_ERROR,
      message: 'msg',
      dimension: longDimension,
    })
    expect(event.dimension.length).toBeLessThanOrEqual(LOG_DIMENSION_MAX)
    expect(event.dimension).toBe('a'.repeat(LOG_DIMENSION_MAX))
  })

  it('omits data when not provided', () => {
    const event = logEvent({
      severity: 'WARNING',
      code: BantayogErrorCode.INVALID_ARGUMENT,
      message: 'Missing required field',
      dimension: 'submit_report',
    })
    expect(event.data).toBeUndefined()
  })

  it('produces JSON-serializable output', () => {
    const event = logEvent({
      severity: 'DEBUG',
      code: BantayogErrorCode.NOT_FOUND,
      message: 'Report not found',
      dimension: 'process_inbox_item',
      data: { reportId: 'abc123', missingField: null, count: 0 },
    })
    const json = JSON.stringify(event)
    const parsed = JSON.parse(json) as object
    expect(parsed).toBeInstanceOf(Object)
    expect(parsed).toHaveProperty('code')
    expect(parsed).toHaveProperty('message')
  })
})
