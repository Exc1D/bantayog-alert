/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
import { setDoc, doc } from 'firebase/firestore'

// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { acceptDispatchCore } from '../accept-dispatch.js'
import { seedActiveAccount } from '../../../__tests__/helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

const ts = 1713350400000

let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'accept-dispatch-test',
      firestore: { host: '127.0.0.1', port: 8081 },
    },
    'accept-dispatch',
  )
  testEnv = guarded.env
  available = guarded.available
  if (!available) return
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
})

/**
 * Seeds a minimal report doc using JS SDK via withSecurityRulesDisabled.
 * Uses numeric timestamps (compatible with RulesTestEnvironment JS SDK context).
 */
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

/**
 * Seeds a dispatch doc using JS SDK via withSecurityRulesDisabled.
 * Uses numeric timestamps to stay compatible with RulesTestEnvironment JS SDK context.
 */
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

const itif = (condition: boolean) => (condition ? it : it.skip)

describe('acceptDispatchCore', () => {
  itif(available)(
    'transitions a pending dispatch to accepted for the assigned responder',
    async () => {
      await seedReportAtStatusJS(testEnv!, 'report-1', 'assigned')
      await seedDispatchJS(testEnv!, 'dispatch-1', 'report-1', 'responder-1', 'pending')
      await seedActiveAccount(testEnv!, {
        uid: 'responder-1',
        role: 'responder',
        municipalityId: 'daet',
      })

      // acceptDispatchCore does a Firestore transaction on idempotency_keys.
      // Bypass emulator security rules so the transaction can read/write that collection.
      await testEnv!.withSecurityRulesDisabled(async (ctx): Promise<void> => {
        const db = ctx.firestore()
        const result = await acceptDispatchCore(db as any, {
          dispatchId: 'dispatch-1',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'responder-1' },
          now: Timestamp.now(),
        })

        expect(result.status).toBe('accepted')

        const dispatchSnap = await db.collection('dispatches').doc('dispatch-1').get()
        expect(dispatchSnap.data()?.status).toBe('accepted')

        const reportSnap = await db.collection('reports').doc('report-1').get()
        expect(reportSnap.data()?.status).toBe('acknowledged')

        const events = await db
          .collection('dispatch_events')
          .where('dispatchId', '==', 'dispatch-1')
          .get()
        const eventTos: string[] = events.docs.map((d) => (d.data() as { to: string }).to)
        expect(eventTos).toContain('accepted')

        const reportEvents = await db
          .collection('report_events')
          .where('reportId', '==', 'report-1')
          .where('to', '==', 'acknowledged')
          .get()
        expect(reportEvents.docs).toHaveLength(1)
      })
    },
  )

  itif(available)('denies when caller is not the assigned responder', async () => {
    await seedReportAtStatusJS(testEnv!, 'report-1', 'assigned')
    await seedDispatchJS(testEnv!, 'dispatch-1', 'report-1', 'responder-1', 'pending')
    await seedActiveAccount(testEnv!, {
      uid: 'responder-2',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await expect(
        acceptDispatchCore(db as any, {
          dispatchId: 'dispatch-1',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'responder-2' },
          now: Timestamp.fromMillis(ts),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  itif(available)('rejects when dispatch is not found (NOT_FOUND)', async () => {
    await seedActiveAccount(testEnv!, {
      uid: 'responder-1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await expect(
        acceptDispatchCore(db as any, {
          dispatchId: 'missing-dispatch-id',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'responder-1' },
          now: Timestamp.fromMillis(ts),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  itif(available)('returns ALREADY_EXISTS when dispatch is no longer pending', async () => {
    await seedReportAtStatusJS(testEnv!, 'report-3', 'assigned')
    await seedDispatchJS(testEnv!, 'dispatch-3', 'report-3', 'responder-1', 'cancelled')
    await seedActiveAccount(testEnv!, {
      uid: 'responder-1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await expect(
        acceptDispatchCore(db as any, {
          dispatchId: 'dispatch-3',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'responder-1' },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })
  })

  itif(available)('is idempotent on same key', async () => {
    await seedReportAtStatusJS(testEnv!, 'report-4', 'assigned')
    await seedDispatchJS(testEnv!, 'dispatch-4', 'report-4', 'responder-1', 'pending')
    await seedActiveAccount(testEnv!, {
      uid: 'responder-1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      const key = crypto.randomUUID()
      const first = await acceptDispatchCore(db as any, {
        dispatchId: 'dispatch-4',
        idempotencyKey: key,
        actor: { uid: 'responder-1' },
        now: Timestamp.now(),
      })
      const second = await acceptDispatchCore(db as any, {
        dispatchId: 'dispatch-4',
        idempotencyKey: key,
        actor: { uid: 'responder-1' },
        now: Timestamp.now(),
      })

      expect(second.fromCache).toBe(true)
      expect(second.status).toBe(first.status)
    })
  })

  itif(available)(
    'returns RESOURCE_EXHAUSTED when responder exceeds 30 accepts/minute',
    async () => {
      await seedActiveAccount(testEnv!, {
        uid: 'responder-rate-limit',
        role: 'responder',
        municipalityId: 'daet',
      })

      // Seed 31 dispatches so we can call accept 31 times without status conflicts
      for (let i = 0; i < 31; i++) {
        const reportId = `report-rl-${String(i)}`
        const dispatchId = `dispatch-rl-${String(i)}`
        await seedReportAtStatusJS(testEnv!, reportId, 'assigned')
        await seedDispatchJS(testEnv!, dispatchId, reportId, 'responder-rate-limit', 'pending')
      }

      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore()
        // Call 30 times to exhaust quota
        for (let i = 0; i < 30; i++) {
          const dispatchId = `dispatch-rl-${String(i)}`

          await acceptDispatchCore(db as any, {
            dispatchId,
            idempotencyKey: crypto.randomUUID(),
            actor: { uid: 'responder-rate-limit' },
            now: Timestamp.now(),
          })
        }
        // 31st call should fail with RESOURCE_EXHAUSTED
        await expect(
          acceptDispatchCore(db as any, {
            dispatchId: 'dispatch-rl-30',
            idempotencyKey: crypto.randomUUID(),
            actor: { uid: 'responder-rate-limit' },
            now: Timestamp.now(),
          }),
        ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
      })
    },
  )
})
