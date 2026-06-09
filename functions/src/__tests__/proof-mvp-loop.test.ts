/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from './helpers/emulator-guard.js'

// Mock RTDB before importing modules that depend on firebase-admin/database
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { verifyReportCore } from '../domains/reports/verify-report.js'
import { dispatchResponderCore } from '../domains/dispatches/dispatch-responder.js'
import { acceptDispatchCore } from '../domains/dispatches/accept-dispatch.js'
import { advanceDispatchCore } from '../domains/dispatches/advance-dispatch.js'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedResponderDoc,
  seedResponderShift,
  staffClaims,
} from './helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

const guarded = await guardInitTestEnvironment(
  {
    projectId: 'proof-mvp-loop',
    firestore: { host: '127.0.0.1', port: 8081 },
    database: { host: '127.0.0.1', port: 9000 },
  },
  'proof-mvp-loop',
)
const testEnv: RulesTestEnvironment | undefined = guarded.env
const available = guarded.available

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
  await Promise.race([
    testEnv.clearDatabase(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('clearDatabase timeout'))
      }, 2000)
    }),
  ]).catch((err: unknown) => {
    if (err instanceof Error && err.message === 'clearDatabase timeout') {
      throw err
    }
    console.warn('[beforeEach] clearDatabase failed:', (err as Error).message)
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

const itif = (condition: boolean) => (condition ? it : it.skip)

describe('proof-mvp-loop', () => {
  itif(available)(
    'exercises full lifecycle: verify → dispatch → accept → advance → resolve',
    async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        const rtdb = testEnv!.unauthenticatedContext().database() as any

        // ── Seed deterministic demo data ──────────────────────────────
        const { reportId } = await seedReportAtStatus(db, 'new', {
          municipalityId: 'daet',
          severity: 'high',
        })

        await seedActiveAccount(testEnv!, {
          uid: 'mvp-admin-1',
          role: 'municipal_admin',
          municipalityId: 'daet',
        })

        await seedResponderDoc(db, {
          uid: 'mvp-responder-1',
          municipalityId: 'daet',
          agencyId: 'bfp-daet',
          isActive: true,
          displayName: 'BFP Daet Test Responder',
        })
        await seedResponderShift(rtdb, 'daet', 'mvp-responder-1', true)

        // Seed a citizen tracking lookup so we can assert safety later
        const publicRef = 'mvp-public-ref-001'
        await db
          .collection('report_lookup')
          .doc(publicRef)
          .set({
            publicTrackingRef: publicRef,
            reportId,
            tokenHash: 'mvp-hash-001',
            expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
            createdAt: Date.now(),
            schemaVersion: 1,
          })

        const adminActor = {
          uid: 'mvp-admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        }
        const responderActor = {
          uid: 'mvp-responder-1',
          claims: { role: 'responder', municipalityId: 'daet' },
        }

        // ── Step 1: verify new → awaiting_verify ────────────────────────
        const v1 = await verifyReportCore(db, {
          reportId,
          idempotencyKey: crypto.randomUUID(),
          actor: adminActor,
          now: Timestamp.now(),
        })
        expect(v1.status).toBe('awaiting_verify')
        expect(v1.reportId).toBe(reportId)

        let report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('awaiting_verify')

        let reportEvents = await db
          .collection('report_events')
          .where('reportId', '==', reportId)
          .get()
        expect(reportEvents.docs).toHaveLength(1)
        expect(reportEvents.docs[0].data()).toMatchObject({
          from: 'new',
          to: 'awaiting_verify',
          actor: 'mvp-admin-1',
        })

        // ── Step 2: verify awaiting_verify → verified ─────────────────────
        const v2 = await verifyReportCore(db, {
          reportId,
          idempotencyKey: crypto.randomUUID(),
          actor: adminActor,
          now: Timestamp.now(),
        })
        expect(v2.status).toBe('verified')

        report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('verified')
        expect(report.verifiedBy).toBe('mvp-admin-1')
        expect(report.verifiedAt).toBeDefined()

        reportEvents = await db.collection('report_events').where('reportId', '==', reportId).get()
        expect(reportEvents.docs).toHaveLength(2)

        // ── Step 3: dispatch responder ────────────────────────────────────
        const dispatchResult = await dispatchResponderCore(db, rtdb, {
          reportId,
          responderUid: 'mvp-responder-1',
          idempotencyKey: crypto.randomUUID(),
          actor: adminActor,
          now: Timestamp.now(),
        })
        expect(dispatchResult.status).toBe('pending')
        expect(dispatchResult.reportId).toBe(reportId)
        const dispatchId = dispatchResult.dispatchId
        expect(dispatchId).toBe(`${reportId}_mvp-responder-1`)

        report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('assigned')
        expect(report.currentDispatchId).toBe(dispatchId)

        reportEvents = await db.collection('report_events').where('reportId', '==', reportId).get()
        expect(reportEvents.docs).toHaveLength(3)
        const reportEventData = reportEvents.docs.map(
          (d: { data: () => Record<string, unknown> }) => d.data(),
        )
        expect(reportEventData).toContainEqual(
          expect.objectContaining({ from: 'verified', to: 'assigned' }),
        )

        let dispatchEvents = await db
          .collection('dispatch_events')
          .where('dispatchId', '==', dispatchId)
          .get()
        expect(dispatchEvents.docs.length).toBeGreaterThanOrEqual(2)

        let dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
        expect(dispatch).toMatchObject({
          dispatchId,
          reportId,
          status: 'pending',
          municipalityId: 'daet',
          assignedTo: {
            uid: 'mvp-responder-1',
            agencyId: 'bfp-daet',
            municipalityId: 'daet',
          },
          dispatchedBy: 'mvp-admin-1',
          dispatchedByRole: 'municipal_admin',
          schemaVersion: 1,
        })
        expect(dispatch.dispatchedAt).toBeDefined()
        expect(dispatch.acknowledgementDeadlineAt).toBeDefined()

        // ── Step 4: accept dispatch ───────────────────────────────────────
        const acceptResult = await acceptDispatchCore(db, {
          dispatchId,
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'mvp-responder-1' },
          now: Timestamp.now(),
        })
        expect(acceptResult.status).toBe('accepted')
        expect(acceptResult.dispatchId).toBe(dispatchId)

        dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
        expect(dispatch.status).toBe('accepted')
        expect(dispatch.acceptedAt).toBeDefined()

        report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('acknowledged') // mirrored from accepted

        reportEvents = await db.collection('report_events').where('reportId', '==', reportId).get()
        expect(reportEvents.docs).toHaveLength(4)

        // ── Step 5: advance accepted → acknowledged ───────────────────────
        const ack = await advanceDispatchCore(db, {
          dispatchId,
          to: 'acknowledged',
          idempotencyKey: crypto.randomUUID(),
          actor: responderActor,
          now: Timestamp.now(),
        })
        expect(ack.status).toBe('acknowledged')

        dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
        expect(dispatch.status).toBe('acknowledged')
        expect(dispatch.acknowledgedAt).toBeDefined()

        report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('acknowledged')

        // ── Step 6: advance acknowledged → en_route ──────────────────────
        const enRoute = await advanceDispatchCore(db, {
          dispatchId,
          to: 'en_route',
          idempotencyKey: crypto.randomUUID(),
          actor: responderActor,
          now: Timestamp.now(),
        })
        expect(enRoute.status).toBe('en_route')

        dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
        expect(dispatch.status).toBe('en_route')
        expect(dispatch.enRouteAt).toBeDefined()

        report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('en_route')

        reportEvents = await db.collection('report_events').where('reportId', '==', reportId).get()
        expect(reportEvents.docs).toHaveLength(5)

        // ── Step 7: advance en_route → on_scene ──────────────────────────
        const onScene = await advanceDispatchCore(db, {
          dispatchId,
          to: 'on_scene',
          idempotencyKey: crypto.randomUUID(),
          actor: responderActor,
          now: Timestamp.now(),
        })
        expect(onScene.status).toBe('on_scene')

        dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
        expect(dispatch.status).toBe('on_scene')
        expect(dispatch.onSceneAt).toBeDefined()

        report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('on_scene')

        reportEvents = await db.collection('report_events').where('reportId', '==', reportId).get()
        expect(reportEvents.docs).toHaveLength(6)

        // ── Step 8: advance on_scene → resolved ─────────────────────────
        const resolved = await advanceDispatchCore(db, {
          dispatchId,
          to: 'resolved',
          resolutionSummary: 'Flooding contained, no injuries. Area secured.',
          idempotencyKey: crypto.randomUUID(),
          actor: responderActor,
          now: Timestamp.now(),
        })
        expect(resolved.status).toBe('resolved')

        // ── Final state assertions ────────────────────────────────────────
        dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
        expect(dispatch.status).toBe('resolved')
        expect(dispatch.resolvedAt).toBeDefined()
        expect(dispatch.resolutionSummary).toBe('Flooding contained, no injuries. Area secured.')
        expect(dispatch.lastStatusAt).toBeDefined()

        report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('resolved')
        expect(report.lastStatusAt).toBeDefined()
        expect(report.lastStatusBy).toBe('mvp-responder-1')

        // resolvedAt lives on the dispatch doc, not the report doc
        dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
        expect(dispatch.resolvedAt).toBeDefined()

        // Dispatch event stream
        dispatchEvents = await db
          .collection('dispatch_events')
          .where('dispatchId', '==', dispatchId)
          .get()
        expect(dispatchEvents.docs).toHaveLength(8)

        // Report event stream
        reportEvents = await db.collection('report_events').where('reportId', '==', reportId).get()
        expect(reportEvents.docs).toHaveLength(7)

        // ── Citizen-safe tracking assertion ─────────────────────────────
        // report_lookup must only map publicRef → reportId without
        // leaking privileged responder/admin fields.
        const lookup = (await db.collection('report_lookup').doc(publicRef).get()).data()
        expect(lookup.reportId).toBe(reportId)
        expect(lookup.publicTrackingRef).toBe(publicRef)
        expect(lookup).not.toHaveProperty('assignedTo')
        expect(lookup).not.toHaveProperty('responderUid')
        expect(lookup).not.toHaveProperty('resolutionSummary')
        expect(lookup).not.toHaveProperty('dispatchId')

        // ── PII separation assertion ────────────────────────────────────
        // Reporter identity must live in report_private, not reports.
        const reportPrivate = (await db.collection('report_private').doc(reportId).get()).data()
        expect(reportPrivate.reporterUid).toBeDefined()
        expect(reportPrivate.rawDescription).toBeDefined()
        expect(report).not.toHaveProperty('reporterUid')
        expect(report).not.toHaveProperty('rawDescription')

        // ── report_ops projection exists ────────────────────────────────
        const reportOps = (await db.collection('report_ops').doc(reportId).get()).data()
        expect(reportOps).toBeDefined()
        expect(reportOps.reportId).toBe(reportId)
      })
    },
  )

  itif(available)('exercises reject path: new → awaiting_verify → rejected', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'new', {
        municipalityId: 'daet',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'mvp-admin-2',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      // Verify to awaiting_verify first
      await verifyReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'mvp-admin-2',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      const { rejectReportCore } = await import('../domains/reports/reject-report.js')
      const rejected = await rejectReportCore(db, {
        reportId,
        reason: 'insufficient_detail',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'mvp-admin-2',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })
      expect(rejected.status).toBe('cancelled_false_report')

      const report = (await db.collection('reports').doc(reportId).get()).data()
      expect(report.status).toBe('cancelled_false_report')
      expect(report.rejectionReason).toBe('insufficient_detail')

      const moderation = await db
        .collection('moderation_incidents')
        .where('reportId', '==', reportId)
        .get()
      expect(moderation.docs).toHaveLength(1)
      expect(moderation.docs[0].data()).toMatchObject({
        reason: 'insufficient_detail',
        actor: 'mvp-admin-2',
      })
    })
  })
})
