import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

const { onCallMock } = vi.hoisted(() => ({
  onCallMock: vi.fn((_config: unknown, handler: unknown) => handler),
}))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  return {
    ...actual,
    onCall: onCallMock,
  }
})

let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import {
  markDispatchUnableToComplete,
  markDispatchUnableToCompleteCore,
} from '../../callables/mark-dispatch-unable-to-complete.js'
import { seedActiveAccount } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'mark-dispatch-unable-to-complete-test',
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

interface SeedDispatchActiveOpts {
  env: RulesTestEnvironment
  dispatchId: string
  reportId: string
  responderUid: string
  status: string
}

async function seedDispatchActive({
  env,
  dispatchId,
  reportId,
  responderUid,
  status,
}: SeedDispatchActiveOpts): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db
      .collection('dispatches')
      .doc(dispatchId)
      .set({
        dispatchId,
        reportId,
        status,
        assignedTo: {
          uid: responderUid,
          agencyId: 'bfp-daet',
          municipalityId: 'daet',
        },
        dispatchedAt: Date.now(),
        lastStatusAt: Date.now(),
        schemaVersion: 1,
      })
  })
}

async function seedReport(
  env: RulesTestEnvironment,
  reportId: string,
  status: string,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.collection('reports').doc(reportId).set({
      reportId,
      status,
      municipalityId: 'daet',
      schemaVersion: 1,
      createdAt: Date.now(),
      lastStatusAt: Date.now(),
    })
  })
}

describe('markDispatchUnableToCompleteCore', () => {
  it('marks an active dispatch unable_to_complete and resets report to verified', async () => {
    await seedReport(testEnv, 'report-1', 'assigned')
    await seedDispatchActive({
      env: testEnv,
      dispatchId: 'dispatch-1',
      reportId: 'report-1',
      responderUid: 'r1',
      status: 'on_scene',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const result = await markDispatchUnableToCompleteCore(db, {
        dispatchId: 'dispatch-1',
        reason: 'Equipment failure',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('unable_to_complete')
      expect(result.dispatchId).toBe('dispatch-1')

      const dispatch = (await db.collection('dispatches').doc('dispatch-1').get()).data()
      expect(dispatch?.status).toBe('unable_to_complete')
      expect(dispatch?.unableToCompleteReason).toBe('Equipment failure')

      const report = (await db.collection('reports').doc('report-1').get()).data()
      expect(report?.status).toBe('verified')
    })
  })

  it('rejects when dispatch is not active', async () => {
    await seedReport(testEnv, 'report-2', 'assigned')
    await seedDispatchActive({
      env: testEnv,
      dispatchId: 'dispatch-2',
      reportId: 'report-2',
      responderUid: 'r1',
      status: 'pending',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        markDispatchUnableToCompleteCore(db, {
          dispatchId: 'dispatch-2',
          reason: 'Cannot reach',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })

  it('is idempotent on same key', async () => {
    await seedReport(testEnv, 'report-3', 'assigned')
    await seedDispatchActive({
      env: testEnv,
      dispatchId: 'dispatch-3',
      reportId: 'report-3',
      responderUid: 'r1',
      status: 'en_route',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const key = crypto.randomUUID()
      const first = await markDispatchUnableToCompleteCore(db, {
        dispatchId: 'dispatch-3',
        reason: 'Road blocked',
        idempotencyKey: key,
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })
      const second = await markDispatchUnableToCompleteCore(db, {
        dispatchId: 'dispatch-3',
        reason: 'Road blocked',
        idempotencyKey: key,
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })

      expect(second.status).toBe(first.status)

      const dispatches = await db
        .collection('dispatch_events')
        .where('dispatchId', '==', 'dispatch-3')
        .get()
      expect(dispatches.docs).toHaveLength(1)
    })
  })

  it('rejects when caller is not the assigned responder', async () => {
    await seedReport(testEnv, 'report-4', 'assigned')
    await seedDispatchActive({
      env: testEnv,
      dispatchId: 'dispatch-4',
      reportId: 'report-4',
      responderUid: 'r1',
      status: 'on_scene',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r2',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        markDispatchUnableToCompleteCore(db, {
          dispatchId: 'dispatch-4',
          reason: 'Not mine',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r2', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })
})

describe('markDispatchUnableToComplete callable', () => {
  const callCallable = markDispatchUnableToComplete as unknown as (request: {
    auth?: { uid: string; token: { role: string; accountStatus: 'active' } }
    data: { dispatchId: string; reason: string; idempotencyKey: string }
  }) => Promise<{ status: 'unable_to_complete'; dispatchId: string }>

  it('rejects unauthenticated request', async () => {
    await expect(
      callCallable({
        data: {
          dispatchId: 'dispatch-x',
          reason: 'No gear',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('rejects wrong-role request', async () => {
    await expect(
      callCallable({
        auth: {
          uid: 'admin-1',
          token: { role: 'municipal_admin', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'dispatch-x',
          reason: 'No gear',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
