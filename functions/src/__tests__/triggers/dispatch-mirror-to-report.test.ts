/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'
import { dispatchMirrorToReportCore } from '../../triggers/dispatch-mirror-to-report.js'

// ---------------------------------------------------------------------------
// Test environment
// ---------------------------------------------------------------------------

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'dispatch-mirror-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

afterEach(async () => {
  await testEnv.cleanup()
})

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/** Seeds a report at a given status using JS SDK via withSecurityRulesDisabled. */
async function seedReportAtStatusJS(
  env: RulesTestEnvironment,
  reportId: string,
  status: string,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db
      .collection('reports')
      .doc(reportId)
      .set({
        reportId,
        status,
        municipalityId: 'daet',
        source: 'citizen_pwa',
        severityDerived: 'medium',
        createdAt: Timestamp.fromMillis(1713350400000),
        lastStatusAt: Timestamp.fromMillis(1713350400000),
        schemaVersion: 1,
      })
    await db
      .collection('report_private')
      .doc(reportId)
      .set({
        reportId,
        reporterUid: 'reporter-1',
        createdAt: Timestamp.fromMillis(1713350400000),
        schemaVersion: 1,
      })
    await db.collection('report_ops').doc(reportId).set({
      reportId,
      verifyQueuePriority: 0,
      assignedMunicipalityAdmins: [],
      schemaVersion: 1,
    })
  })
}

/** Seeds a dispatch using JS SDK via withSecurityRulesDisabled. */
async function seedDispatchJS(
  env: RulesTestEnvironment,
  dispatchId: string,
  reportId: string,
  status: string,
  correlationId?: string,
): Promise<void> {
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
          uid: 'responder-1',
          agencyId: 'bfp-daet',
          municipalityId: 'daet',
        },
        dispatchedAt: Timestamp.fromMillis(1713350400000),
        lastStatusAt: Timestamp.fromMillis(1713350400000),
        correlationId: correlationId ?? crypto.randomUUID(),
        schemaVersion: 1,
      })
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dispatchMirrorToReport', () => {
  it('mirrors accepted → reports.status=acknowledged', async () => {
    const { reportId, dispatchId } = await seedPendingDispatch(testEnv)
    const db = testEnv.unauthenticatedContext().firestore() as any

    // Simulate dispatch transitioning from pending → accepted
    await dispatchMirrorToReportCore({
      db,
      dispatchId,
      beforeData: { status: 'pending' },
      afterData: { status: 'accepted', reportId, correlationId: crypto.randomUUID() },
    })

    const r = await db.collection('reports').doc(reportId).get()
    expect(r.data()?.status).toBe('acknowledged')
  })

  it('appends report_events on each mirrored change', async () => {
    const { reportId, dispatchId } = await seedAcceptedDispatch(testEnv)
    const db = testEnv.unauthenticatedContext().firestore() as any

    await dispatchMirrorToReportCore({
      db,
      dispatchId,
      beforeData: { status: 'accepted' },
      afterData: { status: 'en_route', reportId, correlationId: crypto.randomUUID() },
    })

    const events = await db
      .collection('report_events')
      .where('reportId', '==', reportId)
      .where('to', '==', 'en_route')
      .get()
    expect(events.docs.length).toBeGreaterThan(0)
    const eventDoc = events.docs[0]
    expect(eventDoc.data().from).toBe('acknowledged')
    expect(eventDoc.data().to).toBe('en_route')
    expect(eventDoc.data().actor).toBe('system:dispatchMirrorToReport')
  })

  it('no-ops when dispatch.status == cancelled', async () => {
    const { reportId, dispatchId } = await seedAcceptedDispatch(testEnv)
    const db = testEnv.unauthenticatedContext().firestore() as any

    const beforeSnap = await db.collection('reports').doc(reportId).get()
    const beforeStatus = beforeSnap.data()?.status

    // cancelled dispatch should not mirror
    await dispatchMirrorToReportCore({
      db,
      dispatchId,
      beforeData: { status: 'accepted' },
      afterData: { status: 'cancelled', reportId, correlationId: crypto.randomUUID() },
    })

    const afterSnap = await db.collection('reports').doc(reportId).get()
    const afterStatus = afterSnap.data()?.status
    expect(afterStatus).toBe(beforeStatus)
  })

  it('skips if reports/{id} is missing (delete race)', async () => {
    const dispatchId = `dispatch-${crypto.randomUUID()}`
    await seedDispatchJS(testEnv, dispatchId, 'nonexistent-report', 'pending')

    const db = testEnv.unauthenticatedContext().firestore() as any

    // Should not throw — trigger skips gracefully
    await expect(
      dispatchMirrorToReportCore({
        db,
        dispatchId,
        beforeData: { status: 'pending' },
        afterData: {
          status: 'accepted',
          reportId: 'nonexistent-report',
          correlationId: crypto.randomUUID(),
        },
      }),
    ).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Seed helpers for specific dispatch states
// ---------------------------------------------------------------------------

async function seedPendingDispatch(
  env: RulesTestEnvironment,
): Promise<{ reportId: string; dispatchId: string }> {
  const reportId = `report-${crypto.randomUUID()}`
  const dispatchId = `dispatch-${crypto.randomUUID()}`
  await seedReportAtStatusJS(env, reportId, 'assigned')
  await seedDispatchJS(env, dispatchId, reportId, 'pending')
  return { reportId, dispatchId }
}

async function seedAcceptedDispatch(
  env: RulesTestEnvironment,
): Promise<{ reportId: string; dispatchId: string }> {
  const reportId = `report-${crypto.randomUUID()}`
  const dispatchId = `dispatch-${crypto.randomUUID()}`
  await seedReportAtStatusJS(env, reportId, 'acknowledged')
  await seedDispatchJS(env, dispatchId, reportId, 'accepted')
  return { reportId, dispatchId }
}
