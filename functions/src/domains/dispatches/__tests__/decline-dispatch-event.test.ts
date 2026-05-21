/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

const mockDbCollection = vi.hoisted(() => vi.fn())
const mockDbDoc = vi.hoisted(() => vi.fn())
const mockDbRunTransaction = vi.hoisted(() => vi.fn())
const mockAdd = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockSet = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())

vi.mock('../../admin-init.js', () => ({
  adminDb: {
    collection: mockDbCollection,
    doc: mockDbDoc,
    runTransaction: mockDbRunTransaction,
  },
}))

vi.mock('../../services/rate-limit.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('../../../idempotency/guard.js', () => ({
  withIdempotency: vi.fn().mockImplementation(async (_db, _key, fn) => {
    const result = await fn()
    return { result, fromCache: false }
  }),
  IdempotencyMismatchError: class extends Error {},
}))

import { declineDispatchCore } from '../decline-dispatch.js'

describe('declineDispatch notification_delivered event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbCollection.mockReturnValue({ doc: mockDbDoc, add: mockAdd })
    mockDbDoc.mockReturnValue({ get: mockGet, update: mockUpdate, set: mockSet })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: 'pending',
        reportId: 'report-1',
        assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
      }),
    })
    mockDbRunTransaction.mockImplementation(async (fn) => {
      const tx = { get: mockGet, update: mockUpdate, set: mockSet }
      return await fn(tx)
    })
    mockAdd.mockResolvedValue({ id: 'event-1' })
    mockUpdate.mockResolvedValue(undefined)
    mockSet.mockResolvedValue(undefined)
  })

  it('writes notification_delivered event with action declined', async () => {
    await declineDispatchCore(
      { collection: mockDbCollection, doc: mockDbDoc, runTransaction: mockDbRunTransaction } as any,
      {
        dispatchId: 'dispatch-1',
        declineReason: 'Unavailable',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'responder-1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      },
    )

    // Find the notification_delivered event among transaction set() calls
    // tx.set(ref, data) — call[0] is ref, call[1] is data
    const setCalls = mockSet.mock.calls
    const deliveredEvent = setCalls.find((call) => call[1]?.type === 'notification_delivered')

    expect(deliveredEvent).toBeDefined()
    if (!deliveredEvent) throw new Error('notification_delivered event not found')
    expect(deliveredEvent[1]).toMatchObject({
      type: 'notification_delivered',
      dispatchId: 'dispatch-1',
      responderUid: 'responder-1',
      agencyId: 'bfp',
      municipalityId: 'daet',
      action: 'declined',
      schemaVersion: 1,
    })
  })
})
