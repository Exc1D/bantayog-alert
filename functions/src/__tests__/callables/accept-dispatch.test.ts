/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'

// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { acceptDispatchCore } from '../../callables/accept-dispatch.js'
import { seedActiveAccount } from '../helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

const ts = 1713350400000

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'accept-dispatch-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
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

describe('acceptDispatchCore', () => {
  it('transitions a pending dispatch to accepted for the assigned responder', async () => {
    await seedReportAtStatusJS(testEnv, 'report-1', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-1', 'report-1', 'responder-1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'responder-1',
      role: 'responder',
      municipalityId: 'daet',
    })

    // acceptDispatchCore does a Firestore transaction on idempotency_keys.
    // Bypass emulator security rules so the transaction can read/write that collection.
    await testEnv.withSecurityRulesDisabled(async (ctx): Promise<void> => {
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

      const events = await db
        .collection('dispatch_events')
        .where('dispatchId', '==', 'dispatch-1')
        .get()
      const eventTos: string[] = events.docs.map((d) => (d.data() as { to: string }).to)
      expect(eventTos).toContain('accepted')
    })
  })

  it('denies when caller is not the assigned responder', async () => {
    await seedReportAtStatusJS(testEnv, 'report-2', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-2', 'report-2', 'responder-1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'responder-2',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async () => {
      const db = testEnv.unauthenticatedContext().firestore() as any
      await expect(
        acceptDispatchCore(db, {
          dispatchId: 'dispatch-2',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'responder-2' },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' })
    })
  })

  it('returns ALREADY_EXISTS when dispatch is no longer pending', async () => {
    await seedReportAtStatusJS(testEnv, 'report-3', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-3', 'report-3', 'responder-1', 'cancelled')
    await seedActiveAccount(testEnv, {
      uid: 'responder-1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async () => {
      const db = testEnv.unauthenticatedContext().firestore() as any
      await expect(
        acceptDispatchCore(db, {
          dispatchId: 'dispatch-3',
          idempotencyKey: crypto.randomUUID(),
          actor: { uid: 'responder-1' },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'already-exists' })
    })
  })

  it('is idempotent on same key', async () => {
    await seedReportAtStatusJS(testEnv, 'report-4', 'assigned')
    await seedDispatchJS(testEnv, 'dispatch-4', 'report-4', 'responder-1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'responder-1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async () => {
      const db = testEnv.unauthenticatedContext().firestore() as any
      const key = crypto.randomUUID()
      const first = await acceptDispatchCore(db, {
        dispatchId: 'dispatch-4',
        idempotencyKey: key,
        actor: { uid: 'responder-1' },
        now: Timestamp.now(),
      })
      const second = await acceptDispatchCore(db, {
        dispatchId: 'dispatch-4',
        idempotencyKey: key,
        actor: { uid: 'responder-1' },
        now: Timestamp.now(),
      })

      expect(second.fromCache).toBe(true)
      expect(second.status).toBe(first.status)
    })
  })
})
