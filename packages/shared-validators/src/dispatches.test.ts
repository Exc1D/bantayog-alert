import { describe, expect, it } from 'vitest'
import { dispatchDocSchema, dispatchStatusSchema } from './dispatches.js'
import { isValidDispatchTransition } from './index.js'

const ts = 1713350400000

describe('dispatchDocSchema', () => {
  it('accepts a canonical pending dispatch', () => {
    expect(
      dispatchDocSchema.parse({
        reportId: 'r-1',
        assignedTo: {
          uid: 'resp-1',
          agencyId: 'bfp',
          municipalityId: 'daet',
        },
        dispatchedBy: 'admin-1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: ts,
        status: 'pending',
        statusUpdatedAt: ts,
        acknowledgementDeadlineAt: ts + 180000,
        idempotencyKey: 'k1',
        idempotencyPayloadHash: 'a'.repeat(64),
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'pending' })
  })

  it('accepts needs_admin status', () => {
    expect(
      dispatchDocSchema.parse({
        reportId: 'r-1',
        assignedTo: {
          uid: 'resp-1',
          agencyId: 'bfp',
          municipalityId: 'daet',
        },
        dispatchedBy: 'admin-1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: ts,
        status: 'needs_admin',
        statusUpdatedAt: ts,
        acknowledgementDeadlineAt: ts + 180000,
        idempotencyKey: 'k1',
        idempotencyPayloadHash: 'a'.repeat(64),
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'needs_admin' })
  })

  it('accepts escalated status', () => {
    expect(
      dispatchDocSchema.parse({
        reportId: 'r-1',
        assignedTo: {
          uid: 'resp-1',
          agencyId: 'bfp',
          municipalityId: 'daet',
        },
        dispatchedBy: 'admin-1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: ts,
        status: 'escalated',
        statusUpdatedAt: ts,
        acknowledgementDeadlineAt: ts + 180000,
        idempotencyKey: 'k1',
        idempotencyPayloadHash: 'a'.repeat(64),
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'escalated' })
  })

  it('rejects invalid status', () => {
    expect(() =>
      dispatchDocSchema.parse({
        reportId: 'r-1',
        assignedTo: {
          uid: 'resp-1',
          agencyId: 'bfp',
          municipalityId: 'daet',
        },
        dispatchedBy: 'admin-1',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: ts,
        status: 'unknown',
        statusUpdatedAt: ts,
        acknowledgementDeadlineAt: ts + 180000,
        idempotencyKey: 'k1',
        idempotencyPayloadHash: 'a'.repeat(64),
        schemaVersion: 1,
      }),
    ).toThrow()
  })
})

describe('dispatchStatusSchema', () => {
  it('accepts all valid dispatch status values including unable_to_complete, needs_admin, escalated', () => {
    const statuses = [
      'pending',
      'accepted',
      'acknowledged',
      'en_route',
      'on_scene',
      'resolved',
      'declined',
      'timed_out',
      'cancelled',
      'superseded',
      'unable_to_complete',
      'needs_admin',
      'escalated',
    ] as const
    for (const status of statuses) {
      expect(dispatchStatusSchema.parse(status)).toBe(status)
    }
  })

  it('rejects invalid status value', () => {
    expect(() => dispatchStatusSchema.parse('invalid')).toThrow()
  })
})

describe('DISPATCH_TRANSITIONS — dispatch hardening additions', () => {
  it('allows pending → needs_admin (deadline exceeded, no candidates)', () => {
    expect(isValidDispatchTransition('pending', 'needs_admin')).toBe(true)
  })

  it('allows pending → escalated (auto-escalated to new responder)', () => {
    expect(isValidDispatchTransition('pending', 'escalated')).toBe(true)
  })

  it('allows escalated → accepted (new responder accepts)', () => {
    expect(isValidDispatchTransition('escalated', 'accepted')).toBe(true)
  })

  it('allows escalated → declined (new responder declines)', () => {
    expect(isValidDispatchTransition('escalated', 'declined')).toBe(true)
  })

  it('allows escalated → needs_admin (second escalation cap reached)', () => {
    expect(isValidDispatchTransition('escalated', 'needs_admin')).toBe(true)
  })

  it('denies needs_admin → accepted (terminal state)', () => {
    expect(isValidDispatchTransition('needs_admin', 'accepted')).toBe(false)
  })

  it('denies needs_admin → escalated (terminal state)', () => {
    expect(isValidDispatchTransition('needs_admin', 'escalated')).toBe(false)
  })
})
