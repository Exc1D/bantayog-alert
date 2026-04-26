/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-condition */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { advanceDispatchCore } from '../../callables/advance-dispatch.js'
import { seedActiveAccount, seedDispatch, seedReportAtStatus } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'advance-dispatch-test',
    firestore: { host: 'localhost', port: 8081 },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup()
  }
})

describe('advanceDispatchCore', () => {
  it('advances dispatch from accepted to acknowledged and creates event', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'accepted',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    const result = await advanceDispatchCore(db, {
      dispatchId,
      to: 'acknowledged',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('acknowledged')

    const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
    expect(dispatch.status).toBe('acknowledged')
    expect(dispatch.acknowledgedAt).toBeDefined()

    const evts = await db.collection('dispatch_events').where('dispatchId', '==', dispatchId).get()
    expect(evts.docs).toHaveLength(1)
    expect(evts.docs[0].data()).toMatchObject({
      from: 'accepted',
      to: 'acknowledged',
      actorUid: 'r1',
    })
  })

  it('rejects INVALID_STATUS_TRANSITION for backward steps (en_route -> acknowledged)', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'en_route',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await expect(
      advanceDispatchCore(db, {
        dispatchId,
        to: 'acknowledged',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })

  it('rejects when dispatch is NOT_FOUND', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await expect(
      advanceDispatchCore(db, {
        dispatchId: 'nonexistent-dispatch',
        to: 'acknowledged',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects when resolutionSummary is missing for resolved transition', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'on_scene',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await expect(
      advanceDispatchCore(db, {
        dispatchId,
        to: 'resolved',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })

  it('advances to resolved with resolutionSummary and lastStatusAt', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const { reportId } = await seedReportAtStatus(db, 'assigned', { municipalityId: 'daet' })
    const { dispatchId } = await seedDispatch(db, {
      reportId,
      responderUid: 'r1',
      municipalityId: 'daet',
      status: 'on_scene',
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    const result = await advanceDispatchCore(db, {
      dispatchId,
      to: 'resolved',
      resolutionSummary: 'Fire extinguished',
      idempotencyKey: crypto.randomUUID(),
      actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
      now: Timestamp.now(),
    })

    expect(result.status).toBe('resolved')

    const dispatch = (await db.collection('dispatches').doc(dispatchId).get()).data()
    expect(dispatch.status).toBe('resolved')
    expect(dispatch.resolutionSummary).toBe('Fire extinguished')
    expect(dispatch.lastStatusAt).toBeDefined()
    expect(dispatch.resolvedAt).toBeDefined()
  })
})
