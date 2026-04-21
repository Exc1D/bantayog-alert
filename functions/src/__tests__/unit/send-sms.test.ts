import { describe, it, expect } from 'vitest'
import { buildEnqueueSmsPayload } from '../../services/send-sms.js'

describe('buildEnqueueSmsPayload', () => {
  it('derives predicted encoding and segment count from rendered body', () => {
    const p = buildEnqueueSmsPayload({
      reportId: 'r1',
      dispatchId: undefined,
      purpose: 'receipt_ack',
      recipientMsisdn: '+639171234567',
      locale: 'tl',
      publicRef: 'abc12345',
      salt: 'test-salt',
      nowMs: 1_700_000_000_000,
      providerId: 'semaphore',
    })
    expect(p.predictedEncoding).toBe('GSM-7')
    expect(p.predictedSegmentCount).toBe(1)
    expect(p.status).toBe('queued')
    expect(p.retryCount).toBe(0)
    expect(p.recipientMsisdn).toBe('+639171234567')
    expect(p.recipientMsisdnHash).toMatch(/^[a-f0-9]{64}$/)
    expect(p.bodyPreviewHash).toMatch(/^[a-f0-9]{64}$/)
    expect(p.idempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    expect(p.schemaVersion).toBe(2)
  })

  it('uses dispatchId in idempotency key for status_update', () => {
    const a = buildEnqueueSmsPayload({
      reportId: 'r1',
      dispatchId: 'd1',
      purpose: 'status_update',
      recipientMsisdn: '+639171234567',
      locale: 'tl',
      publicRef: 'abc12345',
      salt: 'test-salt',
      nowMs: 1_700_000_000_000,
      providerId: 'semaphore',
    })
    const b = buildEnqueueSmsPayload({
      reportId: 'r1',
      dispatchId: 'd2',
      purpose: 'status_update',
      recipientMsisdn: '+639171234567',
      locale: 'tl',
      publicRef: 'abc12345',
      salt: 'test-salt',
      nowMs: 1_700_000_000_000,
      providerId: 'semaphore',
    })
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })

  it('produces the same idempotency key for the same inputs', () => {
    const args = {
      reportId: 'r1',
      dispatchId: undefined,
      purpose: 'receipt_ack' as const,
      recipientMsisdn: '+639171234567',
      locale: 'tl' as const,
      publicRef: 'abc12345',
      salt: 'test-salt',
      nowMs: 1_700_000_000_000,
      providerId: 'semaphore' as const,
    }
    expect(buildEnqueueSmsPayload(args).idempotencyKey).toBe(
      buildEnqueueSmsPayload(args).idempotencyKey,
    )
  })
})
