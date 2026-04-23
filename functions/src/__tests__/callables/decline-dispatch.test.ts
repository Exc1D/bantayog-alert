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

  it('rejects when dispatch is not found (NOT_FOUND)', async () => {
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        declineDispatchCore(db, {
          dispatchId: 'missing-dispatch',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  it('rejects when dispatch.assignedTo is missing', async () => {
    await seedReportAtStatusJS(testEnv, 'report-missing-assignee', 'assigned')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'dispatches', 'dispatch-missing-assignee'), {
        dispatchId: 'dispatch-missing-assignee',
        reportId: 'report-missing-assignee',
        status: 'pending',
        dispatchedAt: ts,
        lastStatusAt: ts,
        schemaVersion: 1,
      })

      await expect(
        declineDispatchCore(db as unknown as Firestore, {
          dispatchId: 'dispatch-missing-assignee',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  it('rejects when dispatch.assignedTo.uid matches but agencyId is missing', async () => {
    await seedReportAtStatusJS(testEnv, 'report-partial-assignee-core', 'assigned')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'dispatches', 'dispatch-partial-assignee-core'), {
        dispatchId: 'dispatch-partial-assignee-core',
        reportId: 'report-partial-assignee-core',
        status: 'pending',
        assignedTo: {
          uid: 'r1',
          municipalityId: 'daet',
        },
        dispatchedAt: ts,
        lastStatusAt: ts,
        schemaVersion: 1,
      })

      await expect(
        declineDispatchCore(db as unknown as Firestore, {
          dispatchId: 'dispatch-partial-assignee-core',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
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

  it('returns RATE_LIMITED when responder exceeds 30 declines/minute', async () => {
    await seedActiveAccount(testEnv, {
      uid: 'responder-rate-limit',
      role: 'responder',
      municipalityId: 'daet',
    })

    for (let i = 0; i < 31; i++) {
      const reportId = `report-decline-rl-${String(i)}`
      const dispatchId = `dispatch-decline-rl-${String(i)}`
      await seedReportAtStatusJS(testEnv, reportId, 'assigned')
      await seedDispatchJS(testEnv, dispatchId, reportId, 'responder-rate-limit', 'pending')
    }

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const now = Timestamp.fromMillis(ts)

      for (let i = 0; i < 30; i++) {
        await declineDispatchCore(db, {
          dispatchId: `dispatch-decline-rl-${String(i)}`,
          declineReason: `Busy ${String(i)}`,
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'responder-rate-limit',
            claims: { role: 'responder', municipalityId: 'daet' },
          },
          now,
        })
      }

      await expect(
        declineDispatchCore(db, {
          dispatchId: 'dispatch-decline-rl-30',
          declineReason: 'Busy 30',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'responder-rate-limit',
            claims: { role: 'responder', municipalityId: 'daet' },
          },
          now,
        }),
      ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    })
  })
})

describe('declineDispatch callable', () => {
  const callDeclineDispatch = declineDispatch as unknown as (request: {
    auth?: { uid: string; token: { role: string; accountStatus: 'active' } }
    data: { dispatchId: string; declineReason: string; idempotencyKey: string }
  }) => Promise<{ status: 'declined' }>

  it('wires App Check config and accepts an authenticated responder request', async () => {
    const shouldEnforce = process.env.NODE_ENV === 'production'
    expect(onCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'asia-southeast1',
        enforceAppCheck: shouldEnforce,
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

  it('rejects an unauthenticated request', async () => {
    await expect(
      callDeclineDispatch({
        data: {
          dispatchId: 'dispatch-unauthenticated',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('rejects a wrong-role request', async () => {
    await expect(
      callDeclineDispatch({
        auth: {
          uid: 'admin-1',
          token: { role: 'municipal_admin', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'dispatch-wrong-role',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('surfaces not-found when dispatch is missing', async () => {
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await expect(
      callDeclineDispatch({
        auth: {
          uid: 'r1',
          token: { role: 'responder', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'missing-dispatch',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('surfaces permission-denied when dispatch.assignedTo is missing', async () => {
    await seedReportAtStatusJS(testEnv, 'report-callable-missing-assignee', 'assigned')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'dispatches', 'dispatch-callable-missing-assignee'), {
        dispatchId: 'dispatch-callable-missing-assignee',
        reportId: 'report-callable-missing-assignee',
        status: 'pending',
        dispatchedAt: ts,
        lastStatusAt: ts,
        schemaVersion: 1,
      })
    })

    await expect(
      callDeclineDispatch({
        auth: {
          uid: 'r1',
          token: { role: 'responder', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'dispatch-callable-missing-assignee',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('surfaces permission-denied when dispatch.assignedTo.uid matches but municipalityId is missing', async () => {
    await seedReportAtStatusJS(testEnv, 'report-callable-partial-assignee', 'assigned')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'dispatches', 'dispatch-callable-partial-assignee'), {
        dispatchId: 'dispatch-callable-partial-assignee',
        reportId: 'report-callable-partial-assignee',
        status: 'pending',
        assignedTo: {
          uid: 'r1',
          agencyId: 'bfp-daet',
        },
        dispatchedAt: ts,
        lastStatusAt: ts,
        schemaVersion: 1,
      })
    })

    await expect(
      callDeclineDispatch({
        auth: {
          uid: 'r1',
          token: { role: 'responder', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'dispatch-callable-partial-assignee',
          declineReason: 'Already handling another incident',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('surfaces resource-exhausted when responder exceeds 30 declines per minute', async () => {
    await seedActiveAccount(testEnv, {
      uid: 'responder-callable-rate-limit',
      role: 'responder',
      municipalityId: 'daet',
    })

    for (let i = 0; i < 31; i++) {
      const reportId = `report-callable-decline-rl-${String(i)}`
      const dispatchId = `dispatch-callable-decline-rl-${String(i)}`
      await seedReportAtStatusJS(testEnv, reportId, 'assigned')
      await seedDispatchJS(
        testEnv,
        dispatchId,
        reportId,
        'responder-callable-rate-limit',
        'pending',
      )
    }

    for (let i = 0; i < 30; i++) {
      await callDeclineDispatch({
        auth: {
          uid: 'responder-callable-rate-limit',
          token: { role: 'responder', accountStatus: 'active' },
        },
        data: {
          dispatchId: `dispatch-callable-decline-rl-${String(i)}`,
          declineReason: `Busy ${String(i)}`,
          idempotencyKey: crypto.randomUUID(),
        },
      })
    }

    await expect(
      callDeclineDispatch({
        auth: {
          uid: 'responder-callable-rate-limit',
          token: { role: 'responder', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'dispatch-callable-decline-rl-30',
          declineReason: 'Busy 30',
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'resource-exhausted' })
  })

  it('rejects idempotency key replay with different payload', async () => {
    await seedReportAtStatusJS(testEnv, 'report-idempotency-mismatch', 'assigned')
    await seedDispatchJS(
      testEnv,
      'dispatch-idempotency-mismatch',
      'report-idempotency-mismatch',
      'r1',
      'pending',
    )
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    const idempotencyKey = crypto.randomUUID()
    await callDeclineDispatch({
      auth: {
        uid: 'r1',
        token: { role: 'responder', accountStatus: 'active' },
      },
      data: {
        dispatchId: 'dispatch-idempotency-mismatch',
        declineReason: 'Already handling another incident',
        idempotencyKey,
      },
    })

    await expect(
      callDeclineDispatch({
        auth: {
          uid: 'r1',
          token: { role: 'responder', accountStatus: 'active' },
        },
        data: {
          dispatchId: 'dispatch-idempotency-mismatch',
          declineReason: 'Vehicle issue',
          idempotencyKey,
        },
      }),
    ).rejects.toMatchObject({
      code: 'already-exists',
      message: 'duplicate request with different payload',
    })
  })
})
