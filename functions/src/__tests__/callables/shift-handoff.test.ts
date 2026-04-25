import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'

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
    role: 'municipal_admin',
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
        activeIncidentIds: [],
        idempotencyKey: 'key-1',
      },
      { uid: 'u1', claims: { role: 'citizen', active: true, auth_time: Math.floor(ts / 1000) } },
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('creates shift_handoffs doc with status pending and no toUid', async () => {
    const result = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: 'End of shift',
        activeIncidentIds: [],
        idempotencyKey: 'key-2',
      },
      adminActor,
    )
    expect(result.success).toBe(true)
    expect(result.handoffId).toBeDefined()
    const created = await adminDb.collection('shift_handoffs').doc(result.handoffId!).get()
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
        activeIncidentIds: [],
        idempotencyKey: 'key-3',
      },
      adminActor,
    )
    expect(result.success).toBe(true)
    const created = await adminDb.collection('shift_handoffs').doc(result.handoffId!).get()
    const snapshot = created.data()?.activeIncidentSnapshot as string[]
    expect(snapshot).toContain('r-active-1')
    expect(snapshot).toContain('r-active-2')
  })

  it('is idempotent', async () => {
    const result1 = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: '',
        activeIncidentIds: [],
        idempotencyKey: 'key-4',
      },
      adminActor,
    )
    const result2 = await initiateShiftHandoffCore(
      adminDb,
      {
        notes: '',
        activeIncidentIds: [],
        idempotencyKey: 'key-4',
      },
      adminActor,
    )
    expect(result1.handoffId).toBe(result2.handoffId)
  })
})

describe('acceptShiftHandoff', () => {
  async function createHandoff(id: string) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shift_handoffs', id), {
        fromUid: 'admin-from',
        municipalityId: 'daet',
        notes: '',
        activeIncidentSnapshot: [],
        status: 'pending',
        createdAt: ts,
        expiresAt: ts + 1800000,
        schemaVersion: 1,
      })
    })
  }

  it('rejects a caller from a different municipality', async () => {
    await createHandoff('h1')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h1', idempotencyKey: 'key-5' },
      {
        uid: 'other-admin',
        claims: {
          role: 'municipal_admin',
          municipalityId: 'labo',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
    )
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('permission-denied')
  })

  it('updates status to accepted and sets toUid', async () => {
    await createHandoff('h2')
    const result = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h2', idempotencyKey: 'key-6' },
      {
        uid: 'admin-to',
        claims: {
          role: 'municipal_admin',
          municipalityId: 'daet',
          active: true,
          auth_time: Math.floor(ts / 1000),
        },
      },
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
        role: 'municipal_admin',
        municipalityId: 'daet',
        active: true,
        auth_time: Math.floor(ts / 1000),
      },
    }
    await acceptShiftHandoffCore(adminDb, { handoffId: 'h3', idempotencyKey: 'key-7' }, actor)
    const result2 = await acceptShiftHandoffCore(
      adminDb,
      { handoffId: 'h3', idempotencyKey: 'key-7' },
      actor,
    )
    expect(result2.success).toBe(true)
  })
})
