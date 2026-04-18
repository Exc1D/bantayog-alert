/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach } from 'vitest'
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { verifyReportCore } from '../../callables/verify-report'
import { seedReportAtStatus, seedActiveAccount, staffClaims } from '../helpers/seed-factories'
import { Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules')
const ts = 1713350400000

let testEnv: RulesTestEnvironment

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'verify-report-test',
    firestore: {
      host: 'localhost',
      port: 8080,
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
    },
  })
  await testEnv.clearFirestore()
})

describe('verifyReportCore', () => {
  it('advances new → awaiting_verify and writes report_event', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

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
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

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
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
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

describe('verifyReportCore error paths', () => {
  it('returns FORBIDDEN when admin is in a different municipality', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'mercedes' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      verifyReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns INVALID_STATUS_TRANSITION on a report already verified', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      verifyReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })

  it('returns INVALID_STATUS_TRANSITION when report is in terminal state', async () => {
    const municipalityId = 'daet'
    const reportId = `terminal-${crypto.randomUUID().slice(0, 8)}`
    // seedReportAtStatus does not support terminal statuses; write directly with numeric ts
    await testEnv.withSecurityRulesDisabled(async (innerCtx) => {
      await innerCtx
        .firestore()
        .collection('reports')
        .doc(reportId)
        .set({
          reportId,
          status: 'cancelled_false_report',
          municipalityId,
          approximateLocation: { municipality: municipalityId },
          createdAt: ts,
          lastStatusAt: ts,
          schemaVersion: 1,
        })
    })
    await seedActiveAccount(testEnv, { uid: 'admin-1', role: 'municipal_admin', municipalityId })
    const adminDb = testEnv
      .authenticatedContext('admin-1', {
        role: 'municipal_admin',
        municipalityId,
        accountStatus: 'active',
      })
      .firestore() as any
    await expect(
      verifyReportCore(adminDb, {
        reportId,
        actor: { uid: 'admin-1', claims: staffClaims({ role: 'municipal_admin', municipalityId }) },
        now: Timestamp.now(),
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })

  it('returns NOT_FOUND on missing report', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      verifyReportCore(db, {
        reportId: 'does-not-exist',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: staffClaims('municipal_admin', 'daet') },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
