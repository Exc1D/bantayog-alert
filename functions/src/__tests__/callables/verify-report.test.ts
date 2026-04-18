import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { verifyReportCore } from '../../callables/verify-report'
import { seedReportAtStatus, seedActiveAccount, staffClaims } from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'verify-report-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

describe('verifyReportCore', () => {
  it('advances new → awaiting_verify and writes report_event', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    const result = await verifyReportCore(db, {
      reportId,
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('awaiting_verify')
    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('awaiting_verify')

    const events = await db.collection('report_events').where('reportId', '==', reportId).get()
    expect(events.docs).toHaveLength(1)
    expect(events.docs[0].data()).toMatchObject({
      from: 'new',
      to: 'awaiting_verify',
      actor: 'admin-1',
    })
  })

  it('advances awaiting_verify → verified and stamps verifiedBy', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })

    const result = await verifyReportCore(db, {
      reportId,
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('verified')
    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('verified')
    expect(report.verifiedBy).toBe('admin-1')
    expect(report.verifiedAt).toBeDefined()
  })

  it('is idempotent: same idempotencyKey returns cached result', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, { uid: 'admin-1', role: 'municipal_admin', municipalityId: 'daet' })
    const key = crypto.randomUUID()

    const first = await verifyReportCore(db, {
      reportId,
      idempotencyKey: key,
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })
    const second = await verifyReportCore(db, {
      reportId,
      idempotencyKey: key,
      actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
      now: Timestamp.now(),
    })

    expect(first.status).toBe('awaiting_verify')
    expect(second.status).toBe('awaiting_verify')
    const events = await db.collection('report_events').where('reportId', '==', reportId).get()
    expect(events.docs).toHaveLength(1) // no double event
  })
})
