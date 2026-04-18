/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { rejectReportCore } from '../../callables/reject-report'
import { seedReportAtStatus, seedActiveAccount, staffClaims } from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment
beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'reject-report-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

describe('rejectReportCore', () => {
  it('transitions awaiting_verify → cancelled_false_report and writes moderation incident', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    const result = await rejectReportCore(db, {
      reportId,
      reason: 'obviously_false',
      notes: 'duplicate from known troll',
      idempotencyKey: crypto.randomUUID(),
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('cancelled_false_report')
    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('cancelled_false_report')

    const incidents = await db
      .collection('moderation_incidents')
      .where('reportId', '==', reportId)
      .get()
    expect(incidents.docs).toHaveLength(1)
    expect(incidents.docs[0].data()).toMatchObject({
      reportId,
      reason: 'obviously_false',
      notes: 'duplicate from known troll',
      actor: 'admin-1',
    })

    const events = await db.collection('report_events').where('reportId', '==', reportId).get()
    expect(events.docs).toHaveLength(1)
    expect(events.docs[0].data()).toMatchObject({
      from: 'awaiting_verify',
      to: 'cancelled_false_report',
    })
  })

  it('rejects non-awaiting_verify states with FAILED_PRECONDITION', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      rejectReportCore(db, {
        reportId,
        reason: 'obviously_false',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('FAILED_PRECONDITION when report is already verified', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      rejectReportCore(db, {
        reportId,
        reason: 'citizen_withdrew',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('rejects cross-muni with PERMISSION_DENIED', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
      municipalityId: 'mercedes',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      rejectReportCore(db, {
        reportId,
        reason: 'obviously_false',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })
})
