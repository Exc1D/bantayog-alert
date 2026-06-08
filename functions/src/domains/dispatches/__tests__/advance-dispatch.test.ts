/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { advanceDispatchCore } from '../advance-dispatch.js'
import {
  seedActiveAccount,
  seedDispatch,
  seedReportAtStatus,
} from '../../../__tests__/helpers/seed-factories.js'

let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'advance-dispatch-test',
      firestore: { host: '127.0.0.1', port: 8081 },
    },
    'advance-dispatch',
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

describe('advanceDispatchCore', () => {
  it('advances dispatch from accepted to acknowledged and creates event', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'on_scene', { municipalityId: 'daet' })
      const { dispatchId } = await seedDispatch(db, {
        reportId,
        responderUid: 'r1',
        municipalityId: 'daet',
        status: 'accepted',
      })
      await seedActiveAccount(env, {
        uid: 'r1',
        role: 'responder',
        municipalityId: 'daet',
      })

      const result = await advanceDispatchCore(db, {
        dispatchId,
        to: 'acknowledged',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('acknowledged')

      const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
      expect(dispatch.status).toBe('acknowledged')
      expect(dispatch.acknowledgedAt).toBeDefined()

      const report = (await db.collection('reports').doc(reportId).get()).data()
      expect(report.status).toBe('acknowledged')

      const evts = await db
        .collection('dispatch_events')
        .where('dispatchId', '==', dispatchId)
        .get()
      expect(evts.docs).toHaveLength(1)
      expect(evts.docs[0].data()).toMatchObject({
        from: 'accepted',
        to: 'acknowledged',
        actorUid: 'r1',
      })

      const reportEvents = await db
        .collection('report_events')
        .where('reportId', '==', reportId)
        .where('to', '==', 'acknowledged')
        .get()
      expect(reportEvents.docs).toHaveLength(1)
    })
  })

  it('rejects INVALID_STATUS_TRANSITION for backward steps (en_route -> acknowledged)', async ({
    skip,
  }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
      const { dispatchId } = await seedDispatch(db, {
        reportId,
        responderUid: 'r1',
        municipalityId: 'daet',
        status: 'en_route',
      })
      await seedActiveAccount(env, {
        uid: 'r1',
        role: 'responder',
        municipalityId: 'daet',
      })

      await expect(
        advanceDispatchCore(db, {
          dispatchId,
          to: 'acknowledged',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
    })
  })

  it('rejects when dispatch is NOT_FOUND', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedActiveAccount(env, {
        uid: 'r1',
        role: 'responder',
        municipalityId: 'daet',
      })

      await expect(
        advanceDispatchCore(db, {
          dispatchId: 'nonexistent-dispatch',
          to: 'acknowledged',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  it('rejects when resolutionSummary is missing for resolved transition', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'on_scene', { municipalityId: 'daet' })
      const { dispatchId } = await seedDispatch(db, {
        reportId,
        responderUid: 'r1',
        municipalityId: 'daet',
        status: 'on_scene',
      })
      await seedActiveAccount(env, {
        uid: 'r1',
        role: 'responder',
        municipalityId: 'daet',
      })

      await expect(
        advanceDispatchCore(db, {
          dispatchId,
          to: 'resolved',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
    })
  })

  it('advances to resolved with resolutionSummary and lastStatusAt', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
      const { dispatchId } = await seedDispatch(db, {
        reportId,
        responderUid: 'r1',
        municipalityId: 'daet',
        status: 'on_scene',
      })
      await seedActiveAccount(env, {
        uid: 'r1',
        role: 'responder',
        municipalityId: 'daet',
      })

      const result = await advanceDispatchCore(db, {
        dispatchId,
        to: 'resolved',
        resolutionSummary: 'Fire extinguished',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('resolved')

      const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
      expect(dispatch.status).toBe('resolved')
      expect(dispatch.resolutionSummary).toBe('Fire extinguished')
      expect(dispatch.lastStatusAt).toBeDefined()
      expect(dispatch.resolvedAt).toBeDefined()

      const report = (await db.collection('reports').doc(reportId).get()).data()
      expect(report.status).toBe('resolved')

      const reportEvents = await db
        .collection('report_events')
        .where('reportId', '==', reportId)
        .where('to', '==', 'resolved')
        .get()
      expect(reportEvents.docs).toHaveLength(1)
    })
  })

  it('rejects when report is already closed', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'closed', { municipalityId: 'daet' })
      const { dispatchId } = await seedDispatch(db, {
        reportId,
        responderUid: 'r1',
        municipalityId: 'daet',
        status: 'accepted',
      })
      await seedActiveAccount(env, {
        uid: 'r1',
        role: 'responder',
        municipalityId: 'daet',
      })

      await expect(
        advanceDispatchCore(db, {
          dispatchId,
          to: 'acknowledged',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })

      const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
      expect(dispatch.status).toBe('accepted')
    })
  })
})
