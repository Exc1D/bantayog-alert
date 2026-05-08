/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { reopenReportCore } from '../../callables/reopen-report.js'
import { redispatchReportCore } from '../../callables/redispatch-report.js'
import { requestProvincialEscalationCore } from '../../callables/request-provincial-escalation.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'
import { seedReportAtStatus, seedResponderDoc, seedDispatch } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'reopen-redispatch-test',
    firestore: { host: 'localhost', port: 8081 },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('reopenReportCore', () => {
  it('transitions a closed report to reopened', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'closed', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      const result = await reopenReportCore(db, {
        reportId,
        reason: 'New evidence requires follow-up',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('reopened')
      const snap = await db.collection('reports').doc(reportId).get()
      expect(snap.data()?.status).toBe('reopened')
      expect(snap.data()?.reopenedReason).toBe('New evidence requires follow-up')
    })
  })

  it('denies admin from another municipality', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'closed', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv, {
        uid: 'admin-mercedes',
        role: 'municipal_admin',
        municipalityId: 'mercedes',
      })

      await expect(
        reopenReportCore(db, {
          reportId,
          reason: 'Follow-up needed',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-mercedes',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  it('rejects reopen on a non-closed report (FAILED_PRECONDITION)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        reopenReportCore(db, {
          reportId,
          reason: 'Should not work',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })
})

describe('redispatchReportCore', () => {
  it('supersedes old dispatch and creates new one', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedResponderDoc(db, {
        uid: 'responder-new',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
      await seedDispatch(db, {
        dispatchId: 'disp-old',
        reportId,
        responderUid: 'responder-old',
        status: 'declined',
      })
      await seedActiveAccount(testEnv, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      const result = await redispatchReportCore(db, {
        oldDispatchId: 'disp-old',
        newResponderUid: 'responder-new',
        reason: 'Original responder declined',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('pending')
      const oldSnap = await db.collection('dispatches').doc('disp-old').get()
      expect(oldSnap.data()?.status).toBe('superseded')

      const newDispatchId = `${reportId}_responder-new`
      const newSnap = await db.collection('dispatches').doc(newDispatchId).get()
      expect(newSnap.data()?.status).toBe('pending')
      expect(newSnap.data()?.assignedTo.uid).toBe('responder-new')
    })
  })

  it('rejects redispatch from non-terminal status', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedResponderDoc(db, {
        uid: 'responder-new',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
      await seedDispatch(db, {
        dispatchId: 'disp-old',
        reportId,
        responderUid: 'responder-old',
        status: 'pending',
      })
      await seedActiveAccount(testEnv, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        redispatchReportCore(db, {
          oldDispatchId: 'disp-old',
          newResponderUid: 'responder-new',
          reason: 'Should fail',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })
})

describe('requestProvincialEscalationCore', () => {
  it('creates escalation request and notification', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedDispatch(db, {
        dispatchId: 'disp-1',
        reportId,
        responderUid: 'responder-1',
        status: 'en_route',
      })

      const result = await requestProvincialEscalationCore(db, {
        dispatchId: 'disp-1',
        reason: 'Need provincial resources',
        notes: 'Helicopter support required',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'responder-1',
          claims: staffClaims({ role: 'responder', agencyId: 'bfp-daet' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('pending')
      expect(result.escalationId).toBeDefined()

      const escalationSnap = await db
        .collection('escalation_requests')
        .doc(result.escalationId)
        .get()
      expect(escalationSnap.exists).toBe(true)
      expect(escalationSnap.data()?.reason).toBe('Need provincial resources')

      const notifSnap = await db.collection('admin_notifications').get()
      expect(notifSnap.size).toBeGreaterThanOrEqual(1)
    })
  })

  it('rejects escalation for inactive dispatch', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedDispatch(db, {
        dispatchId: 'disp-1',
        reportId,
        responderUid: 'responder-1',
        status: 'resolved',
      })

      await expect(
        requestProvincialEscalationCore(db, {
          dispatchId: 'disp-1',
          reason: 'Should fail',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'responder-1',
            claims: staffClaims({ role: 'responder', agencyId: 'bfp-daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })
})
