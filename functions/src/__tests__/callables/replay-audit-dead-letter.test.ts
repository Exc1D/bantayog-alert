import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

let mockDb: Firestore

const mockStreamAuditEventOrThrow = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: unknown, fn: unknown) => fn),
  HttpsError: class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
}))

vi.mock('../../services/audit-stream.js', () => ({
  streamAuditEventOrThrow: mockStreamAuditEventOrThrow,
  DEAD_LETTER_CATEGORY_AUDIT_STREAM: 'audit_stream',
  DEAD_LETTER_STATUS_STREAMED: 'streamed',
}))

function createMockDb(deadLetters: { category: string; status: string; payload: unknown }[]) {
  const updateFn = vi.fn().mockResolvedValue(undefined)
  const docs = deadLetters.map((data, index) => ({
    id: `dl-${String(index + 1)}`,
    data: () => data,
    ref: { update: updateFn },
  }))
  const getFn = vi.fn().mockResolvedValue({ docs, size: docs.length })
  const limitFn = vi.fn(() => query)
  const query = { get: getFn, limit: limitFn }
  const whereFn = vi.fn(() => query)
  const collectionFn = vi.fn((collectionName: string) => {
    if (collectionName !== 'dead_letters') {
      throw new Error(`unexpected collection: ${collectionName}`)
    }
    return { where: whereFn }
  })

  return {
    collection: collectionFn,
    _updateFn: updateFn,
    _getFn: getFn,
    _whereFn: whereFn,
    _limitFn: limitFn,
  } as unknown as Firestore & {
    _updateFn: typeof updateFn
    _getFn: typeof getFn
    _whereFn: typeof whereFn
    _limitFn: typeof limitFn
  }
}

import { replayAuditDeadLetter } from '../../callables/replay-audit-dead-letter.js'

beforeEach(() => {
  mockStreamAuditEventOrThrow.mockClear()
  mockStreamAuditEventOrThrow.mockResolvedValue(undefined)
})

describe('replayAuditDeadLetter', () => {
  it('replays failed audit stream events and marks them streamed', async () => {
    const db = createMockDb([
      {
        category: 'audit_stream',
        status: 'failed_to_stream',
        payload: { eventType: 'test', actorUid: 'user-1', occurredAt: 123456 },
      },
      {
        category: 'audit_stream',
        status: 'failed_to_stream',
        payload: { eventType: 'test2', actorUid: 'user-2', occurredAt: 123457 },
      },
    ])
    mockDb = db

    const invokeReplay = replayAuditDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: Record<string, never>
    }) => Promise<{ replayed: number }>

    const result = await invokeReplay({
      auth: {
        uid: 'super-1',
        token: { role: 'provincial_superadmin' },
      },
      data: {},
    })

    expect(result).toEqual({ replayed: 2 })
    expect(mockStreamAuditEventOrThrow).toHaveBeenCalledTimes(2)
    expect(mockStreamAuditEventOrThrow).toHaveBeenNthCalledWith(1, {
      eventType: 'test',
      actorUid: 'user-1',
      occurredAt: 123456,
    })
    expect(mockStreamAuditEventOrThrow).toHaveBeenNthCalledWith(2, {
      eventType: 'test2',
      actorUid: 'user-2',
      occurredAt: 123457,
    })
    expect(db._updateFn).toHaveBeenCalledTimes(2)
    expect(db._updateFn).toHaveBeenCalledWith({
      status: 'streamed',
      streamedAt: expect.any(Number),
      streamedBy: 'super-1',
    })
  })

  it('returns 0 when no failed audit events exist', async () => {
    mockDb = createMockDb([])

    const invokeReplay = replayAuditDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: Record<string, never>
    }) => Promise<{ replayed: number }>

    const result = await invokeReplay({
      auth: {
        uid: 'super-1',
        token: { role: 'provincial_superadmin' },
      },
      data: {},
    })

    expect(result).toEqual({ replayed: 0 })
    expect(mockStreamAuditEventOrThrow).not.toHaveBeenCalled()
  })

  it('skips items that are not failed_to_stream', async () => {
    const db = createMockDb([
      {
        category: 'audit_stream',
        status: 'streamed',
        payload: { eventType: 'already-streamed', actorUid: 'user-1', occurredAt: 123456 },
      },
      {
        category: 'audit_stream',
        status: 'failed_to_stream',
        payload: { eventType: 'needs-replay', actorUid: 'user-2', occurredAt: 123457 },
      },
    ])
    mockDb = db

    const invokeReplay = replayAuditDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: Record<string, never>
    }) => Promise<{ replayed: number }>

    const result = await invokeReplay({
      auth: {
        uid: 'super-1',
        token: { role: 'provincial_superadmin' },
      },
      data: {},
    })

    expect(result).toEqual({ replayed: 1 })
    expect(mockStreamAuditEventOrThrow).toHaveBeenCalledTimes(1)
    expect(mockStreamAuditEventOrThrow).toHaveBeenCalledWith({
      eventType: 'needs-replay',
      actorUid: 'user-2',
      occurredAt: 123457,
    })
    expect(db._updateFn).toHaveBeenCalledTimes(1)
  })

  it('rejects non-superadmin callers', async () => {
    mockDb = createMockDb([])

    const invokeReplay = replayAuditDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: Record<string, never>
    }) => Promise<{ replayed: number }>

    await expect(
      invokeReplay({
        auth: {
          uid: 'muni-1',
          token: { role: 'municipal_admin' },
        },
        data: {},
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('does not mark streamed when streamAuditEventOrThrow fails', async () => {
    mockStreamAuditEventOrThrow.mockRejectedValue(new Error('bq error'))
    const db = createMockDb([
      {
        category: 'audit_stream',
        status: 'failed_to_stream',
        payload: { eventType: 'test', actorUid: 'user-1', occurredAt: 123456 },
      },
    ])
    mockDb = db

    const invokeReplay = replayAuditDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: Record<string, never>
    }) => Promise<{ replayed: number }>

    const result = await invokeReplay({
      auth: {
        uid: 'super-1',
        token: { role: 'provincial_superadmin' },
      },
      data: {},
    })

    expect(result).toEqual({ replayed: 0 })
    expect(db._updateFn).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated callers', async () => {
    mockDb = createMockDb([])

    const invokeReplay = replayAuditDeadLetter as unknown as (request: {
      auth?: { uid: string; token: { role: string } }
      data: Record<string, never>
    }) => Promise<{ replayed: number }>

    await expect(
      invokeReplay({
        data: {},
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})
