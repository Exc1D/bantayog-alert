import { describe, expect, it } from 'vitest'
import { dispatchDocSchema, dispatchStatusSchema } from './dispatches.js'
import { isValidDispatchTransition } from './state-machines/dispatch-states.js'

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
  it('accepts all valid status values (Phase 3c: en_route + on_scene)', () => {
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
    ] as const
    for (const status of statuses) {
      expect(dispatchStatusSchema.parse(status)).toBe(status)
    }
  })

  it('rejects invalid status value', () => {
    expect(() => dispatchStatusSchema.parse('invalid')).toThrow()
  })
})

describe('DISPATCH_TRANSITIONS — 3c additions', () => {
  it('allows acknowledged → en_route', () => {
    expect(isValidDispatchTransition('acknowledged', 'en_route')).toBe(true)
  })
  it('allows en_route → on_scene', () => {
    expect(isValidDispatchTransition('en_route', 'on_scene')).toBe(true)
  })
  it('allows on_scene → resolved', () => {
    expect(isValidDispatchTransition('on_scene', 'resolved')).toBe(true)
  })
  it('denies en_route → resolved (must pass through on_scene)', () => {
    expect(isValidDispatchTransition('en_route', 'resolved')).toBe(false)
  })
  it('admin can cancel from accepted/acknowledged/en_route/on_scene', () => {
    for (const from of ['accepted', 'acknowledged', 'en_route', 'on_scene'] as const) {
      expect(isValidDispatchTransition(from, 'cancelled')).toBe(true)
    }
  })
})
