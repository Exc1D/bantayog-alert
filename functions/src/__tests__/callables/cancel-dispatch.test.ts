/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))
import { cancelDispatchCore } from '../../callables/cancel-dispatch.js'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedDispatch,
  staffClaims,
} from '../helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment
beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'cancel-dispatch-test',
    firestore: { host: 'localhost', port: 8080 },
  })
  await testEnv.clearFirestore()
})

describe('cancelDispatchCore (3b branches)', () => {
  it('cancels a pending dispatch and reverts report to verified', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'pending',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    const result = await cancelDispatchCore(db, {
      dispatchId,
      reason: 'responder_unavailable',
      idempotencyKey: crypto.randomUUID(),
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('cancelled')

    const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
    expect(dispatch.status).toBe('cancelled')
    expect(dispatch.cancelledBy).toBe('admin-1')

    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('verified')
    expect(report.currentDispatchId).toBeNull()

    const evts = await db.collection('dispatch_events').where('dispatchId', '==', dispatchId).get()
    expect(evts.docs).toHaveLength(1)
    expect(evts.docs[0].data()).toMatchObject({ from: 'pending', to: 'cancelled' })
  })

  it('PERMISSION_DENIED when cancelling a dispatch for a different muni', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'mercedes' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r2',
      municipalityId: 'mercedes',
      status: 'pending',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      cancelDispatchCore(db, {
        dispatchId,
        reason: 'responder_unavailable',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('FAILED_PRECONDITION when dispatch is in terminal state (resolved)', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'resolved',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      cancelDispatchCore(db, {
        dispatchId,
        reason: 'responder_unavailable',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('FAILED_PRECONDITION when dispatch is in terminal state (declined)', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'declined',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      cancelDispatchCore(db, {
        dispatchId,
        reason: 'responder_unavailable',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('NOT_FOUND when dispatch does not exist', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    await expect(
      cancelDispatchCore(db, {
        dispatchId: 'nonexistent-dispatch-id',
        reason: 'admin_error',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('cancels non-current dispatch without reverting report status', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    // Point the report at a different (newer) dispatch so this one is superseded
    await db.collection('reports').doc(reportId).update({ currentDispatchId: 'newer-dispatch-id' })

    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'pending',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })

    const result = await cancelDispatchCore(db, {
      dispatchId,
      reason: 'admin_error',
      idempotencyKey: crypto.randomUUID(),
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('cancelled')

    const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
    expect(dispatch.status).toBe('cancelled')

    // Report must NOT be reverted — it's bound to the newer dispatch
    const report = (await db.collection('reports').doc(reportId).get()).data()
    expect(report.status).toBe('assigned')
    expect(report.currentDispatchId).toBe('newer-dispatch-id')
  })

  it('INVALID_STATUS_TRANSITION when dispatch is already cancelled', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'pending',
    })
    await seedActiveAccount(testEnv, {
      uid: 'admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    // First cancel succeeds
    await cancelDispatchCore(db, {
      dispatchId,
      reason: 'responder_unavailable',
      idempotencyKey: crypto.randomUUID(),
      actor: {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      },
      now: Timestamp.now(),
    })
    // Second cancel should fail with INVALID_STATUS_TRANSITION
    await expect(
      cancelDispatchCore(db, {
        dispatchId,
        reason: 'admin_error',
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

describe('cancelDispatch — widened from-state (3c)', () => {
  const CANCELLABLE_FROM = ['accepted', 'acknowledged', 'en_route', 'on_scene'] as const

  for (const from of CANCELLABLE_FROM) {
    it(`allows cancel from ${from} → status=cancelled, report reverted to verified`, async () => {
      const db = testEnv.unauthenticatedContext().firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
      const { dispatchId } = await seedDispatch(db, {
        reportId,
        responderUid: 'r1',
        municipalityId: 'daet',
        status: from,
      })
      await seedActiveAccount(testEnv, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      const result = await cancelDispatchCore(db, {
        dispatchId,
        reason: 'admin_error',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('cancelled')

      const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
      expect(dispatch.status).toBe('cancelled')
      expect(dispatch.cancelledBy).toBe('admin-1')

      const report = (await db.collection('reports').doc(reportId).get()).data()
      expect(report.status).toBe('verified')
      expect(report.currentDispatchId).toBeNull()

      const evts = await db
        .collection('dispatch_events')
        .where('dispatchId', '==', dispatchId)
        .get()
      expect(evts.docs).toHaveLength(1)
      expect(evts.docs[0].data()).toMatchObject({ from, to: 'cancelled' })
    })
  }
})
