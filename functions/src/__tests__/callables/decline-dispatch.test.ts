import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
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

import { declineDispatch, declineDispatchCore } from '../../callables/decline-dispatch.js'
import { seedActiveAccount } from '../helpers/seed-factories.js'

const ts = 1713350400000

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'decline-dispatch-test',
    firestore: {
      host: 'localhost',
      port: 8080,
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

async function seedReportAtStatusJS(
  env: RulesTestEnvironment,
  reportId: string,
  status: string,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'reports', reportId), {
      reportId,
      status,
      municipalityId: 'daet',
      source: 'citizen_pwa',
      severityDerived: 'medium',
      createdAt: ts,
      lastStatusAt: ts,
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'report_private', reportId), {
      reportId,
      reporterUid: 'reporter-1',
      createdAt: ts,
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'report_ops', reportId), {
      reportId,
      verifyQueuePriority: 0,
      assignedMunicipalityAdmins: [],
      schemaVersion: 1,
    })
  })
}

async function seedDispatchJS(
  env: RulesTestEnvironment,
  dispatchId: string,
  reportId: string,
  responderUid: string,
  status: string,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'dispatches', dispatchId), {
      dispatchId,
      reportId,
      status,
      assignedTo: {
        uid: responderUid,
        agencyId: 'bfp-daet',
        municipalityId: 'daet',
      },
      dispatchedAt: ts,
      lastStatusAt: ts,
      schemaVersion: 1,
    })
  })
}

describe('declineDispatchCore', () => {
  it('declines a pending dispatch with a required reason', async () => {
    await seedReportAtStatusJS(testEnv, 'report-1', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-1', 'report-1', 'r1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const result = await declineDispatchCore(db, {
        dispatchId: 'dispatch-1',
        declineReason: 'Already handling another incident',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('declined')

      const dispatch = (await db.collection('dispatches').doc('dispatch-1').get()).data()
      expect(dispatch).toMatchObject({
        status: 'declined',
        declineReason: 'Already handling another incident',
      })

      const evts = await db
        .collection('dispatch_events')
        .where('dispatchId', '==', 'dispatch-1')
        .get()
      expect(evts.docs).toHaveLength(1)
      const [firstEvt] = evts.docs
      expect(firstEvt).toBeDefined()
      expect(firstEvt!.data()).toMatchObject({
        agencyId: 'bfp-daet',
        municipalityId: 'daet',
        dispatchId: 'dispatch-1',
        reportId: 'report-1',
        actor: 'r1',
        actorRole: 'responder',
        fromStatus: 'pending',
        toStatus: 'declined',
        reason: 'Already handling another incident',
        schemaVersion: 1,
      })
    })
  })

  it('rejects when declineReason is blank', async () => {
    await seedReportAtStatusJS(testEnv, 'report-2', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-2', 'report-2', 'r1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        declineDispatchCore(db, {
          dispatchId: 'dispatch-2',
          declineReason: '   ',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    })
  })

  it('rejects when declineReason exceeds 200 characters', async () => {
    await seedReportAtStatusJS(testEnv, 'report-2b', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-2b', 'report-2b', 'r1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    const callDeclineDispatch = declineDispatch as unknown as (request: {
      auth: { uid: string; token: { role: string; accountStatus: 'active' } }
      data: { dispatchId: string; declineReason: string; idempotencyKey: string }
    }) => Promise<{ status: 'declined' }>

    await expect(
      callDeclineDispatch({
        auth: {
          uid: 'r1',
          token: { role: 'responder', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'dispatch-2b',
          declineReason: 'x'.repeat(201),
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('rejects when dispatch is not pending', async () => {
    await seedReportAtStatusJS(testEnv, 'report-3', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-3', 'report-3', 'r1', 'accepted')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        declineDispatchCore(db, {
          dispatchId: 'dispatch-3',
          declineReason: 'Too far away',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
    })
  })

  it('rejects when the dispatch is assigned to another responder', async () => {
    await seedReportAtStatusJS(testEnv, 'report-4', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-4', 'report-4', 'r1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'r2',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        declineDispatchCore(db, {
          dispatchId: 'dispatch-4',
          declineReason: 'Not my incident',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r2', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  it('returns the same result without duplicating events when replayed with the same idempotency key', async () => {
    await seedReportAtStatusJS(testEnv, 'report-5b', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-5b', 'report-5b', 'r1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const key = crypto.randomUUID()
      const first = await declineDispatchCore(db, {
        dispatchId: 'dispatch-5b',
        declineReason: 'Already handling another incident',
        idempotencyKey: key,
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })
      const second = await declineDispatchCore(db, {
        dispatchId: 'dispatch-5b',
        declineReason: 'Already handling another incident',
        idempotencyKey: key,
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })

      expect(second).toEqual(first)

      const evts = await db
        .collection('dispatch_events')
        .where('dispatchId', '==', 'dispatch-5b')
        .get()
      expect(evts.docs).toHaveLength(1)
    })
  })
})

describe('declineDispatch callable', () => {
  it('wires App Check config and accepts an authenticated responder request', async () => {
    expect(onCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'asia-southeast1',
        enforceAppCheck: true,
        timeoutSeconds: 10,
        minInstances: 1,
      }),
      expect.any(Function),
    )

    await seedReportAtStatusJS(testEnv, 'report-5', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-5', 'report-5', 'r1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    const callDeclineDispatch = declineDispatch as unknown as (request: {
      auth: { uid: string; token: { role: string; accountStatus: 'active' } }
      data: { dispatchId: string; declineReason: string; idempotencyKey: string }
    }) => Promise<{ status: 'declined' }>

    const result = await callDeclineDispatch({
      auth: {
        uid: 'r1',
        token: { role: 'responder', accountStatus: 'active' },
      },
      data: {
        dispatchId: 'dispatch-5',
        declineReason: 'Already assigned to another incident',
        idempotencyKey: crypto.randomUUID(),
      },
    })

    expect(result).toMatchObject({ status: 'declined' })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const dispatch = (await db.collection('dispatches').doc('dispatch-5').get()).data()
      expect(dispatch).toMatchObject({
        status: 'declined',
        declineReason: 'Already assigned to another incident',
      })
    })
  })
})
