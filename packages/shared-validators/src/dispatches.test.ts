import { describe, expect, it } from 'vitest'
import { dispatchDocSchema, dispatchStatusSchema } from './dispatches.js'

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
  it('accepts all valid status values', () => {
    const statuses = [
      'pending',
      'accepted',
      'acknowledged',
      'in_progress',
      'resolved',
      'declined',
      'timed_out',
      'cancelled',
      'superseded',
    ] as const
    for (const status of statuses) {
      expect(dispatchStatusSchema.parse(status)).toBe(status)
    }
  })

  it('rejects invalid status value', () => {
    expect(() => dispatchStatusSchema.parse('invalid')).toThrow()
  })
})
