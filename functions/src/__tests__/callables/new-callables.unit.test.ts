import { describe, it, expect, vi } from 'vitest'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { createUserSchema } from '../../callables/create-user.js'
import { createResponderSchema } from '../../callables/create-responder.js'
import { redispatchReportSchema } from '../../callables/redispatch-report.js'
import { reopenReportSchema } from '../../callables/reopen-report.js'
import { requestProvincialEscalationSchema } from '../../callables/request-provincial-escalation.js'

describe('createUserSchema', () => {
  it('accepts a well-formed superadmin creation request', () => {
    expect(
      createUserSchema.parse({
        displayName: 'Admin Santos',
        phone: '+639171234567',
        role: 'provincial_superadmin',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      displayName: 'Admin Santos',
      phone: '+639171234567',
      role: 'provincial_superadmin',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('accepts a municipal_admin with municipalityId', () => {
    expect(
      createUserSchema.parse({
        displayName: 'Muni Admin',
        phone: '+639171234568',
        role: 'municipal_admin',
        municipalityId: 'daet',
        idempotencyKey: '00000000-0000-4000-8000-000000000002',
      }),
    ).toMatchObject({ municipalityId: 'daet' })
  })

  it('accepts a responder with specializations', () => {
    expect(
      createUserSchema.parse({
        displayName: 'Officer Cruz',
        phone: '+639171234569',
        role: 'responder',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        specializations: ['Swift Water Rescue'],
        idempotencyKey: '00000000-0000-4000-8000-000000000003',
      }),
    ).toMatchObject({ specializations: ['Swift Water Rescue'] })
  })

  it('rejects empty displayName', () => {
    expect(() =>
      createUserSchema.parse({
        displayName: '',
        phone: '+639171234567',
        role: 'municipal_admin',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })

  it('rejects invalid role', () => {
    expect(() =>
      createUserSchema.parse({
        displayName: 'Bad Role',
        phone: '+639171234567',
        role: 'citizen',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })

  it('rejects non-UUID idempotencyKey', () => {
    expect(() =>
      createUserSchema.parse({
        displayName: 'Bad Key',
        phone: '+639171234567',
        role: 'municipal_admin',
        idempotencyKey: 'not-a-uuid',
      }),
    ).toThrow()
  })
})

describe('createResponderSchema', () => {
  it('accepts a well-formed request', () => {
    expect(
      createResponderSchema.parse({
        displayName: 'FO3 Reyes',
        phone: '+639171234567',
        agencyId: 'bfp-daet',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      displayName: 'FO3 Reyes',
      phone: '+639171234567',
      agencyId: 'bfp-daet',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('accepts optional municipalityId and specializations', () => {
    expect(
      createResponderSchema.parse({
        displayName: 'FO3 Reyes',
        phone: '+639171234567',
        agencyId: 'bfp-daet',
        municipalityId: 'daet',
        specializations: ['Hazmat', 'SAR'],
        idempotencyKey: '00000000-0000-4000-8000-000000000002',
      }),
    ).toMatchObject({ municipalityId: 'daet', specializations: ['Hazmat', 'SAR'] })
  })

  it('rejects missing agencyId', () => {
    expect(() =>
      createResponderSchema.parse({
        displayName: 'FO3 Reyes',
        phone: '+639171234567',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })
})

describe('redispatchReportSchema', () => {
  it('accepts a well-formed request', () => {
    expect(
      redispatchReportSchema.parse({
        oldDispatchId: 'dispatch-abc-123',
        newResponderUid: 'responder-xyz-789',
        reason: 'Original responder declined',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      oldDispatchId: 'dispatch-abc-123',
      newResponderUid: 'responder-xyz-789',
      reason: 'Original responder declined',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('rejects empty reason', () => {
    expect(() =>
      redispatchReportSchema.parse({
        oldDispatchId: 'd-1',
        newResponderUid: 'r-1',
        reason: '  ',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })
})

describe('reopenReportSchema', () => {
  it('accepts a well-formed request', () => {
    expect(
      reopenReportSchema.parse({
        reportId: 'report-abc-123',
        reason: 'New evidence requires follow-up',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      reportId: 'report-abc-123',
      reason: 'New evidence requires follow-up',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('rejects empty reason', () => {
    expect(() =>
      reopenReportSchema.parse({
        reportId: 'r-1',
        reason: '',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })
})

describe('requestProvincialEscalationSchema', () => {
  it('accepts a well-formed request', () => {
    expect(
      requestProvincialEscalationSchema.parse({
        dispatchId: 'dispatch-abc-123',
        reason: 'Need provincial-level resources',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      dispatchId: 'dispatch-abc-123',
      reason: 'Need provincial-level resources',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('accepts optional notes', () => {
    expect(
      requestProvincialEscalationSchema.parse({
        dispatchId: 'dispatch-abc-123',
        reason: 'Need resources',
        notes: 'Specifically requesting helicopter support',
        idempotencyKey: '00000000-0000-4000-8000-000000000002',
      }),
    ).toMatchObject({ notes: 'Specifically requesting helicopter support' })
  })

  it('rejects empty reason', () => {
    expect(() =>
      requestProvincialEscalationSchema.parse({
        dispatchId: 'd-1',
        reason: '',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })
})
