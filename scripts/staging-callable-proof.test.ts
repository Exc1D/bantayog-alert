import { describe, expect, it } from 'vitest'
import { buildCitizenReportPayload, buildProofCleanupPaths } from './staging-callable-proof'

describe('buildCitizenReportPayload', () => {
  it('produces a callable envelope that satisfies the submit contract', () => {
    const data = buildCitizenReportPayload(1_756_000_000_000)

    // Outer envelope: exactly the strict submitCitizenReportSchema keys.
    expect(Object.keys(data).sort()).toEqual(
      [
        'clientCreatedAt',
        'correlationId',
        'idempotencyKey',
        'payload',
        'publicRef',
        'secretHash',
      ].sort(),
    )
    expect(data.clientCreatedAt).toBe(1_756_000_000_000)
    expect(data.publicRef).toMatch(/^[a-z0-9]{8}$/)
    expect(data.secretHash).toMatch(/^[a-f0-9]{64}$/)
    expect(data.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(data.idempotencyKey.length).toBeGreaterThan(0)
  })

  it('builds a web payload with required triage and a daet location', () => {
    const { payload } = buildCitizenReportPayload(1_756_000_000_000)

    expect(payload.source).toBe('web')
    expect(payload.municipalityId).toBe('daet')
    expect(payload.severity).toBe('high')
    expect(payload.triage).toMatchObject({
      peopleInjured: expect.any(Boolean),
      peopleTrapped: expect.any(Boolean),
      locationConfidence: 'exact',
    })
    expect(payload.publicLocation).toMatchObject({
      lat: expect.any(Number),
      lng: expect.any(Number),
    })
  })

  it('generates a fresh publicRef and correlationId on each call', () => {
    const a = buildCitizenReportPayload(1)
    const b = buildCitizenReportPayload(1)
    expect(a.publicRef).not.toBe(b.publicRef)
    expect(a.correlationId).not.toBe(b.correlationId)
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })
})

describe('buildProofCleanupPaths', () => {
  it('returns the fixed proof document paths for deletion', () => {
    const paths = buildProofCleanupPaths({
      reportId: 'r-1',
      publicRef: 'abcd1234',
      secretHash: 'f'.repeat(64),
      dispatchId: 'r-1_bfp-responder-test-01',
    })

    expect(paths).toEqual([
      'reports/r-1',
      'report_private/r-1',
      'report_ops/r-1',
      'report_lookup/abcd1234',
      `secret_lookup/${'f'.repeat(64)}`,
      'dispatches/r-1_bfp-responder-test-01',
    ])
  })

  it('does not include event-stream collections (those are query-deleted)', () => {
    const paths = buildProofCleanupPaths({
      reportId: 'r-1',
      publicRef: 'abcd1234',
      secretHash: 'f'.repeat(64),
      dispatchId: 'r-1_x',
    })
    expect(paths.some((p) => p.startsWith('report_events/'))).toBe(false)
    expect(paths.some((p) => p.startsWith('dispatch_events/'))).toBe(false)
  })
})
