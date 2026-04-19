/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { closeReportCore } from '../../callables/close-report.js'
import { seedReportAtStatus, seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'close-report-test',
    firestore: { host: 'localhost', port: 8080 },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('closeReportCore', () => {
  it('transitions a resolved report to closed', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    const result = await closeReportCore(db, {
      reportId,
      idempotencyKey: crypto.randomUUID(),
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('closed')
    const snap = await db.collection('reports').doc(reportId).get()
    expect(snap.data()?.status).toBe('closed')
  })

  it('denies admin from another municipality', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-mercedes',
      role: 'municipal_admin',
      municipalityId: 'mercedes',
    })

    await expect(
      closeReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-mercedes',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('rejects close on a non-existent report (NOT_FOUND)', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    await expect(
      closeReportCore(db, {
        reportId: 'missing-report-id',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects close on a non-resolved report', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    await expect(
      closeReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('appends a report_events entry from:resolved to:closed', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    await closeReportCore(db, {
      reportId,
      idempotencyKey: crypto.randomUUID(),
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    const events = await db
      .collection('report_events')
      .where('reportId', '==', reportId)
      .orderBy('at', 'desc')
      .get()
    const eventData: Record<string, unknown>[] = events.docs.map(
      (doc: any) => doc.data() as Record<string, unknown>,
    )
    const last = eventData[0]
    expect(last).toMatchObject({ from: 'resolved', to: 'closed' })
  })

  it('stores closureSummary when provided', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    await closeReportCore(db, {
      reportId,
      idempotencyKey: crypto.randomUUID(),
      closureSummary: 'All responders stood down, incident closed.',
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    const snap = await db.collection('reports').doc(reportId).get()
    expect(snap.data()?.closureSummary).toBe('All responders stood down, incident closed.')
  })

  it('is idempotent — replay with same key returns closed without error', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    const key = crypto.randomUUID()

    const first = await closeReportCore(db, {
      reportId,
      idempotencyKey: key,
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })
    expect(first.status).toBe('closed')

    // Replay with same key — should succeed (fromCache=true behavior)
    const second = await closeReportCore(db, {
      reportId,
      idempotencyKey: key,
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })
    expect(second.status).toBe('closed')

    // Only one event should exist (no duplicate)
    const events = await db.collection('report_events').where('reportId', '==', reportId).get()
    const closeEvents = events.docs.filter((doc: any) => doc.data().to === 'closed')
    expect(closeEvents).toHaveLength(1)
  })
})
