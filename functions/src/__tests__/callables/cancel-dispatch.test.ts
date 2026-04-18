/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))
import { cancelDispatchCore } from '../../callables/cancel-dispatch'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedDispatch,
  staffClaims,
} from '../helpers/seed-factories'
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

  it('FAILED_PRECONDITION when dispatch is not pending (3b scope)', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'accepted',
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
