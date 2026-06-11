/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

const mockSendFcmToResponder = vi.hoisted(() => vi.fn())
const mockSendFcmToCitizen = vi.hoisted(() => vi.fn())
const mockWithIdempotency = vi.hoisted(() => vi.fn())
const mockDbCollection = vi.hoisted(() => vi.fn())
const mockDbDoc = vi.hoisted(() => vi.fn())
const mockDbRunTransaction = vi.hoisted(() => vi.fn())
const mockAdd = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockSet = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())

vi.mock('../../ops/fcm-send.js', () => ({
  sendFcmToCitizen: mockSendFcmToCitizen,
  sendFcmToResponder: mockSendFcmToResponder,
}))

vi.mock('../../../admin-init.js', () => ({
  adminDb: {
    collection: mockDbCollection,
    doc: mockDbDoc,
    runTransaction: mockDbRunTransaction,
  },
  rtdb: {},
}))

vi.mock('../../shared/rate-limit.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('../../../idempotency/guard.js', () => ({
  withIdempotency: mockWithIdempotency,
  IdempotencyMismatchError: class extends Error {},
}))

vi.mock('../dispatch-responder-validation.js', () => ({
  validateDispatchTransaction: vi.fn().mockResolvedValue({
    report: { severityDerived: 'high' },
    responder: {
      uid: 'responder-1',
      agencyId: 'bfp',
      municipalityId: 'daet',
      displayName: 'Test Responder',
      isActive: true,
    },
    from: 'pending',
  }),
}))

vi.mock('../dispatch-responder-writes.js', () => ({
  writeDispatchDocs: vi.fn(),
}))

vi.mock('../../ops/admin-auth.js', () => ({
  isAccountActive: vi.fn().mockReturnValue(true),
}))

import { dispatchResponderCore } from '../dispatch-responder.js'

describe('dispatchResponder FCM tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWithIdempotency.mockImplementation(async (_db, _key, fn) => {
      const result = await fn()
      return { result, fromCache: false }
    })
    mockSendFcmToCitizen.mockResolvedValue({ warnings: [] })
    mockDbCollection.mockReturnValue({ doc: mockDbDoc, add: mockAdd })
    mockDbDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
      set: mockSet,
    })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
      }),
    })
    mockDbRunTransaction.mockImplementation((fn) => {
      const tx = {
        get: mockGet,
        update: mockUpdate,
        set: mockSet,
      }
      return Promise.resolve(fn(tx))
    })
    mockAdd.mockResolvedValue({ id: 'event-1' })
    mockUpdate.mockResolvedValue(undefined)
    mockSet.mockResolvedValue(undefined)
  })

  it('writes notification_attempted event after FCM succeeds', async () => {
    mockSendFcmToResponder.mockResolvedValue({ warnings: [], sentCount: 1, failedCount: 0 })

    const result = await dispatchResponderCore(
      {
        collection: mockDbCollection,
        doc: mockDbDoc,
        runTransaction: mockDbRunTransaction,
      } as any,
      {} as any,
      {
        reportId: 'report-1',
        responderUid: 'responder-1',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
        now: Timestamp.now(),
      },
    )

    // Verify FCM was called
    expect(mockSendFcmToResponder).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'responder-1',
        title: 'New dispatch',
      }),
    )
    expect(mockSendFcmToCitizen).toHaveBeenCalledWith({
      reportId: 'report-1',
      title: 'Help is on the way',
      body: 'A response team from bfp has been assigned to your report.',
      data: expect.objectContaining({ reportId: 'report-1', dispatchId: result.dispatchId }),
    })

    // Verify notification_attempted event was written to dispatch_events
    expect(mockDbCollection).toHaveBeenCalledWith('dispatch_events')
    const addCalls = mockAdd.mock.calls
    const attemptedEvent = addCalls.find((call) => call[0]?.type === 'notification_attempted')
    expect(attemptedEvent).toBeDefined()
    if (!attemptedEvent) throw new Error('notification_attempted event not found')
    expect(attemptedEvent[0]).toMatchObject({
      type: 'notification_attempted',
      dispatchId: result.dispatchId,
      responderUid: 'responder-1',
      fcmResult: 'sent',
      schemaVersion: 1,
    })
    const citizenAttemptedEvent = addCalls.find((call) => call[0]?.audience === 'citizen')
    expect(citizenAttemptedEvent).toBeDefined()
    if (!citizenAttemptedEvent) throw new Error('citizen notification_attempted event not found')
    expect(citizenAttemptedEvent[0]).toMatchObject({
      type: 'notification_attempted',
      reportId: 'report-1',
      dispatchId: result.dispatchId,
      channel: 'push',
      audience: 'citizen',
      fcmResult: 'sent',
      fcmWarnings: [],
      schemaVersion: 1,
    })

    // Verify dispatch doc updated with fcmResult
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fcmResult: 'sent',
        fcmWarnings: [],
      }),
    )
  })

  it('writes fcm_retry_queue on network_error', async () => {
    mockSendFcmToResponder.mockResolvedValue({
      warnings: ['fcm_network_error'],
      sentCount: 0,
      failedCount: 1,
    })

    const result = await dispatchResponderCore(
      {
        collection: mockDbCollection,
        doc: mockDbDoc,
        runTransaction: mockDbRunTransaction,
      } as any,
      {} as any,
      {
        reportId: 'report-2',
        responderUid: 'responder-2',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
        now: Timestamp.now(),
      },
    )

    // Verify notification_attempted event shows network_error
    const addCalls = mockAdd.mock.calls
    const attemptedEvent = addCalls.find((call) => call[0]?.type === 'notification_attempted')
    expect(attemptedEvent).toBeDefined()
    if (!attemptedEvent) throw new Error('notification_attempted event not found')
    expect(attemptedEvent[0]).toMatchObject({
      fcmResult: 'network_error',
      fcmWarnings: ['fcm_network_error'],
    })

    // Verify fcm_retry_queue doc created
    expect(mockDbCollection).toHaveBeenCalledWith('fcm_retry_queue')
    const retryCall = addCalls.find((call) => call[0]?.status === 'pending')
    expect(retryCall).toBeDefined()
    if (!retryCall) throw new Error('fcm_retry_queue doc not found')
    expect(retryCall[0]).toMatchObject({
      dispatchId: result.dispatchId,
      responderUid: 'responder-2',
      status: 'pending',
      originalError: 'fcm_network_error',
    })
  })

  it('returns fcmResult and fcmWarnings in callable response', async () => {
    mockSendFcmToResponder.mockResolvedValue({
      warnings: ['fcm_one_token_invalid'],
      sentCount: 1,
      failedCount: 0,
    })

    const result = await dispatchResponderCore(
      {
        collection: mockDbCollection,
        doc: mockDbDoc,
        runTransaction: mockDbRunTransaction,
      } as any,
      {} as any,
      {
        reportId: 'report-3',
        responderUid: 'responder-3',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
        now: Timestamp.now(),
      },
    )

    // Verify result includes fcmResult
    expect(result).toMatchObject({
      dispatchId: expect.any(String),
      status: 'pending',
      fcmResult: 'sent_with_invalid_tokens',
      fcmWarnings: ['fcm_one_token_invalid'],
    })
  })

  it('does not send or write notification attempts on idempotent replay', async () => {
    mockWithIdempotency.mockResolvedValue({
      result: {
        dispatchId: 'dispatch-1',
        status: 'pending',
        reportId: 'report-1',
        correlationId: 'correlation-1',
        fcmResult: 'sent',
        fcmWarnings: [],
      },
      fromCache: true,
    })

    const result = await dispatchResponderCore(
      {
        collection: mockDbCollection,
        doc: mockDbDoc,
        runTransaction: mockDbRunTransaction,
      } as any,
      {} as any,
      {
        reportId: 'report-1',
        responderUid: 'responder-1',
        idempotencyKey: crypto.randomUUID(),
        actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
        now: Timestamp.now(),
      },
    )

    expect(result.dispatchId).toBe('dispatch-1')
    expect(mockSendFcmToResponder).not.toHaveBeenCalled()
    expect(mockSendFcmToCitizen).not.toHaveBeenCalled()
    expect(mockAdd).not.toHaveBeenCalled()
  })
})
