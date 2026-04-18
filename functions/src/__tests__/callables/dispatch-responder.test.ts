import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { dispatchResponderCore } from '../../callables/dispatch-responder'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedResponderDoc,
  seedResponderShift,
  staffClaims,
} from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'dispatch-responder-test',
    firestore: { host: 'localhost', port: 8080 },
    database: { host: 'localhost', port: 9000 },
  })
  await testEnv.clearFirestore()
  await testEnv.clearDatabase()
})

describe('dispatchResponderCore', () => {
  it('creates dispatch, transitions report → assigned, writes both event streams', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any

    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    await testEnv.withSecurityRulesDisabled(async () => {
      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
    })
    await seedResponderShift(rtdb, 'daet', 'r1', true)

    const result = await dispatchResponderCore(db, rtdb, {
      reportId,
      responderUid: 'r1',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('pending')
    expect(result.dispatchId).toBeDefined()

    const dispatch = (await db.collection('dispatches').doc(result.dispatchId).get()).data()
    expect(dispatch).toMatchObject({
      reportId,
      status: 'pending',
      assignedTo: { uid: 'r1', agencyId: 'bfp-daet', municipalityId: 'daet' },
    })

    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('assigned')

    const reportEvents = await db
      .collection('report_events')
      .where('reportId', '==', reportId)
      .get()
    expect(reportEvents.docs).toHaveLength(1)
    const dispatchEvents = await db
      .collection('dispatch_events')
      .where('dispatchId', '==', result.dispatchId)
      .get()
    expect(dispatchEvents.docs).toHaveLength(1)
  })

  it('sets acknowledgementDeadlineAt according to severity', async () => {
    const ctx = testEnv.unauthenticatedContext()
    const db = ctx.firestore() as any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', {
      municipalityId: 'daet',
      severity: 'high',
    })
    await seedActiveAccount(testEnv, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    await testEnv.withSecurityRulesDisabled(async () => {
      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
    })
    await seedResponderShift(rtdb, 'daet', 'r1', true)
    const now = Timestamp.now()
    const result = await dispatchResponderCore(db, rtdb, {
      reportId,
      responderUid: 'r1',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now,
    })
    const dispatch = (await db.collection('dispatches').doc(result.dispatchId).get()).data()
    expect(dispatch.acknowledgementDeadlineAt.toMillis() - now.toMillis()).toBeCloseTo(
      5 * 60 * 1000,
      -3,
    )
  })
})
