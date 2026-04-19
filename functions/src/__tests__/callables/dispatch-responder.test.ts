/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, getDocs } from 'firebase/firestore'

// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { dispatchResponderCore } from '../../callables/dispatch-responder.js'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedResponderDoc,
  seedResponderShift,
  staffClaims,
} from '../helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'dispatch-responder-test',
    firestore: { host: 'localhost', port: 8080 },
    database: { host: 'localhost', port: 9000 },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.clearDatabase()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('dispatchResponderCore', () => {
  it('creates dispatch, transitions report → assigned, writes both event streams', async () => {
    const ctx = testEnv.unauthenticatedContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtdb = ctx.database() as any

    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

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
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', {
      municipalityId: 'daet',
      severity: 'high',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

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
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now,
    })
    const dispatch = (await db.collection('dispatches').doc(result.dispatchId).get()).data()
    expect(dispatch.acknowledgementDeadlineAt.toMillis() - now.toMillis()).toBeCloseTo(
      5 * 60 * 1000,
      -3,
    )
  })
})

describe('dispatchResponderCore error paths', () => {
  it('PERMISSION_DENIED when responder is in another municipality', async () => {
    const ctx = testEnv.unauthenticatedContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async () => {
      await seedResponderDoc(db, {
        uid: 'r-wrong-muni',
        municipalityId: 'mercedes',
        agencyId: 'bfp-mercedes',
        isActive: true,
      })
    })
    await seedResponderShift(rtdb, 'mercedes', 'r-wrong-muni', true)
    await expect(
      dispatchResponderCore(db, rtdb, {
        reportId,
        responderUid: 'r-wrong-muni',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('INVALID_STATUS_TRANSITION when report is not verified', async () => {
    const ctx = testEnv.unauthenticatedContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async () => {
      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
    })
    await seedResponderShift(rtdb, 'daet', 'r1', true)
    await expect(
      dispatchResponderCore(db, rtdb, {
        reportId,
        responderUid: 'r1',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })

  it('INVALID_STATUS_TRANSITION when responder is not on shift', async () => {
    const ctx = testEnv.unauthenticatedContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async () => {
      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
    })
    await seedResponderShift(rtdb, 'daet', 'r1', false)
    await expect(
      dispatchResponderCore(db, rtdb, {
        reportId,
        responderUid: 'r1',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })
})

describe('dispatchResponderCore SMS enqueue', () => {
  beforeEach(() => {
    process.env.SMS_MSISDN_HASH_SALT = 'test-sms-salt-ph4a'
  })

  it('enqueues status_update SMS when reporter consented', async () => {
    const ctx = testEnv.unauthenticatedContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', {
      municipalityId: 'daet',
      reporterContact: { phone: '+639171234567', smsConsent: true, locale: 'tl' },
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
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
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    const outboxQ = await getDocs(collection(db, 'sms_outbox'))
    expect(outboxQ.size).toBe(1)
    const outbox = outboxQ.docs[0]!.data()
    expect(outbox.purpose).toBe('status_update')
    expect(outbox.reportId).toBe(reportId)
    expect(outbox.dispatchId).toBe(result.dispatchId)
    expect(outbox.recipientMsisdn).toBe('+639171234567')
    expect(outbox.status).toBe('queued')
  })

  it('does NOT enqueue SMS when reporter had no consent', async () => {
    const ctx = testEnv.unauthenticatedContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rtdb = ctx.database() as any
    const { reportId } = await seedReportAtStatus(db, 'verified', {
      municipalityId: 'daet',
      // no reporterContact
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await testEnv.withSecurityRulesDisabled(async () => {
      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
    })
    await seedResponderShift(rtdb, 'daet', 'r1', true)

    await dispatchResponderCore(db, rtdb, {
      reportId,
      responderUid: 'r1',
      idempotencyKey: crypto.randomUUID(),
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    const outboxQ = await getDocs(collection(db, 'sms_outbox'))
    expect(outboxQ.size).toBe(0)
  })
})
