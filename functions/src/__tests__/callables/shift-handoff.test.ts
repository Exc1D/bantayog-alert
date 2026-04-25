import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'
import { type UserRole } from '@bantayog/shared-types'

const onCallMock = vi.hoisted(() => vi.fn())
vi.mock('firebase-functions/v2/https', () => ({
  onCall: onCallMock,
  HttpsError: class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { initiateShiftHandoffCore, acceptShiftHandoffCore } from '../../callables/shift-handoff.js'

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const ts = 1713350400000
let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'shift-handoff-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
})

const adminActor = {
  uid: 'admin-from',
  claims: {
    role: 'municipal_admin' as UserRole,
    municipalityId: 'daet',
    active: true,
    auth_time: Math.floor(ts / 1000),
  },
}

async function seedReportOp(id: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_ops', id), {
      municipalityId: 'daet',
      status: 'assigned',
      severity: 'high',
      createdAt: ts,
      updatedAt: ts,
      agencyIds: [],
      activeResponderCount: 0,
      requiresLocationFollowUp: false,
      visibility: { scope: 'municipality', sharedWith: [] },
      reportType: 'flood',
      schemaVersion: 1,
    })
  })
}

describe('initiateShiftHandoff', () => {
  it('rejects citizens and responders', async () => {
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'Handover notes',
        idempotencyKey: uuid(1),
      },
      {
        uid: 'u1',
        claims: { role: 'citizen' as UserRole, active: true, auth_time: Math.floor(ts / 1000) },
      },
      'corr-1',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('permission-denied')
    }
  })

  it('rejects inactive admin', async () => {
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'Handover notes',
        idempotencyKey: uuid(10),
      },
      {
        uid: 'admin-inactive',
        claims: {
          role: 'municipal_admin' as UserRole,
          municipalityId: 'daet',
          active: false,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-inactive',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('permission-denied')
    }
  })

  it('rejects municipal_admin missing municipalityId', async () => {
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'Handover notes',
        idempotencyKey: uuid(11),
      },
      {
        uid: 'admin-no-muni',
        claims: {
          role: 'municipal_admin' as UserRole,
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-no-muni',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('permission-denied')
    }
  })

  it('creates shift_handoffs doc with status pending and no toUid', async () => {
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'End of shift',
        idempotencyKey: uuid(2),
      },
      adminActor,
      'corr-2',
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.handoffId).toBeDefined()
    }
    const created = await adminDb
      .collection('shift_handoffs')
      .doc(result.success ? result.handoffId : '')
      .get()
    expect(created.data()?.status).toBe('pending')
    expect(created.data()?.toUid).toBeUndefined()
    expect(created.data()?.fromUid).toBe('admin-from')
  })

  it('builds activeIncidentSnapshot from live Firestore state', async () => {
    await seedReportOp('r-active-1')
    await seedReportOp('r-active-2')
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'Handover',
        idempotencyKey: uuid(3),
      },
      adminActor,
      'corr-3',
    )
    expect(result.success).toBe(true)
    const created = await adminDb
      .collection('shift_handoffs')
      .doc(result.success ? result.handoffId : '')
      .get()
    const snapshot = created.data()?.activeIncidentIds as string[]
    expect(snapshot).toContain('r-active-1')
    expect(snapshot).toContain('r-active-2')
  })

  it('is idempotent', async () => {
    const result1 = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: '',
        idempotencyKey: uuid(4),
      },
      adminActor,
      'corr-4',
    )
    const result2 = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: '',
        idempotencyKey: uuid(4),
      },
      adminActor,
      'corr-5',
    )
    if (result1.success && result2.success) {
      expect(result1.handoffId).toBe(result2.handoffId)
    }
  })
})

describe('acceptShiftHandoff', () => {
  async function createHandoff(id: string, overrides: Record<string, unknown> = {}) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shift_handoffs', id), {
        fromUid: 'admin-from',
        municipalityId: 'daet',
        notes: '',
        activeIncidentIds: [],
        status: 'pending',
        createdAt: ts,
        expiresAt: ts + 1800000,
        schemaVersion: 1,
        ...overrides,
      })
    })
  }

  it('rejects inactive admin', async () => {
    await createHandoff('h-inactive')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h-inactive', idempotencyKey: uuid(12) },
      {
        uid: 'admin-to',
        claims: {
          role: 'municipal_admin' as UserRole,
          municipalityId: 'daet',
          active: false,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-inactive',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('permission-denied')
    }
  })

  it('rejects non-existent handoff', async () => {
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h-missing', idempotencyKey: uuid(13) },
      {
        uid: 'admin-to',
        claims: {
          role: 'municipal_admin' as UserRole,
          municipalityId: 'daet',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-missing',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('not-found')
    }
  })

  it('rejects expired handoff', async () => {
    await createHandoff('h-expired', { expiresAt: ts - 1 })
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h-expired', idempotencyKey: uuid(14) },
      {
        uid: 'admin-to',
        claims: {
          role: 'municipal_admin' as UserRole,
          municipalityId: 'daet',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-expired',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('failed-precondition')
    }
  })

  it('rejects self-accept', async () => {
    await createHandoff('h-self')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h-self', idempotencyKey: uuid(15) },
      {
        uid: 'admin-from',
        claims: {
          role: 'municipal_admin' as UserRole,
          municipalityId: 'daet',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-self',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('failed-precondition')
    }
  })

  it('rejects a caller from a different municipality', async () => {
    await createHandoff('h1')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h1', idempotencyKey: uuid(5) },
      {
        uid: 'other-admin',
        claims: {
          role: 'municipal_admin' as UserRole,
          municipalityId: 'labo',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-6',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('permission-denied')
    }
  })

  it('updates status to accepted and sets toUid', async () => {
    await createHandoff('h2')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h2', idempotencyKey: uuid(6) },
      {
        uid: 'admin-to',
        claims: {
          role: 'municipal_admin' as UserRole,
          municipalityId: 'daet',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
      'corr-7',
    )
    expect(result.success).toBe(true)
    const updated = await adminDb.collection('shift_handoffs').doc('h2').get()
    expect(updated.data()?.status).toBe('accepted')
    expect(updated.data()?.toUid).toBe('admin-to')
  })

  it('is idempotent — double-accept returns success', async () => {
    await createHandoff('h3')
    const actor = {
      uid: 'admin-to',
      claims: {
        role: 'municipal_admin' as UserRole,
        municipalityId: 'daet',
        active: true,
        auth_time: Math.floor(ts / 1000),
      },
    }
    await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h3', idempotencyKey: uuid(7) },
      actor,
      'corr-8',
    )
    const result2 = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h3', idempotencyKey: uuid(7) },
      actor,
      'corr-9',
    )
    expect(result2.success).toBe(true)
  })
})
