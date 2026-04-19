import { describe, it, expect } from 'vitest'
import { closeReportRequestSchema } from '../../callables/close-report.js'

describe('closeReportRequestSchema', () => {
  it('accepts well-formed request', () => {
    const result = closeReportRequestSchema.parse({
      reportId: 'report-abc123',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      closureSummary: 'Resolved by municipal admin.',
    })
    expect(result).toEqual({
      reportId: 'report-abc123',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      closureSummary: 'Resolved by municipal admin.',
    })
  })

  it('rejects missing reportId', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toThrow()
  })

  it('rejects non-UUID idempotencyKey', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        reportId: 'report-abc123',
        idempotencyKey: 'not-a-uuid',
        closureSummary: 'Resolved.',
      }),
    ).toThrow()
  })

  it('rejects whitespace-only closureSummary', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        reportId: 'report-abc123',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        closureSummary: '   ',
      }),
    ).toThrow()
  })

  it('rejects too-long closureSummary (> 2000 chars)', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        reportId: 'report-abc123',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        closureSummary: 'x'.repeat(2001),
      }),
    ).toThrow()
  })
})
