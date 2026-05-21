import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dispatchTimeoutSweepCore } from '../dispatch-timeout-sweep.js'
import { Timestamp } from 'firebase-admin/firestore'

const createMockTimestamp = (millis: number): Timestamp =>
  ({ toMillis: () => millis }) as unknown as Timestamp

function createMockDoc(
  id: string,
  data: Record<string, unknown>,
): FirebaseFirestore.QueryDocumentSnapshot {
  return {
    id,
    data: () => data,
    ref: { path: `dispatches/${id}` },
  } as unknown as FirebaseFirestore.QueryDocumentSnapshot
}

interface BatchOp {
  type: 'update' | 'set'
  ref: { path: string }
  data: unknown
}

function createMockDb(opts: {
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
}): FirebaseFirestore.Firestore & {
  __batchOps: BatchOp[]
  __batchCommitCount: number
} {
  const batchOps: BatchOp[] = []
  let batchCommitCount = 0

  const batch = {
    update: vi.fn((ref: { path: string }, data: unknown) => {
      batchOps.push({ type: 'update', ref, data })
    }),
    set: vi.fn((ref: { path: string }, data: unknown) => {
      batchOps.push({ type: 'set', ref, data })
    }),
    commit: vi.fn(() => {
      batchCommitCount++
      return Promise.resolve(undefined)
    }),
  }

  const db = {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(() =>
          Promise.resolve({
            docs: opts.docs,
          }),
        ),
      })),
      doc: vi.fn(() => ({
        id: `event-${Math.random().toString(36).slice(2)}`,
      })),
    })),
    batch: vi.fn(() => batch),
  } as unknown as FirebaseFirestore.Firestore

  Object.defineProperty(db, '__batchOps', { value: batchOps, enumerable: true, configurable: true })
  Object.defineProperty(db, '__batchCommitCount', {
    get() {
      return batchCommitCount
    },
    enumerable: true,
    configurable: true,
  })

  return db as unknown as FirebaseFirestore.Firestore & {
    __batchOps: BatchOp[]
    __batchCommitCount: number
  }
}

describe('dispatchTimeoutSweepCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('times out a dispatch whose deadline has expired', async () => {
    const now = createMockTimestamp(1_000_000)
    const expiredDeadline = createMockTimestamp(500_000)
    const docs = [
      createMockDoc('d1', {
        acknowledgementDeadlineAt: expiredDeadline,
        reportId: 'r1',
      }),
    ]

    const db = createMockDb({ docs })
    await dispatchTimeoutSweepCore(db, now)

    expect(db.__batchOps).toHaveLength(2)
    expect(db.__batchOps[0]).toMatchObject({ type: 'update', data: { status: 'timed_out' } })
    expect(db.__batchOps[1]).toMatchObject({
      type: 'set',
      data: { dispatchId: 'd1', to: 'timed_out' },
    })

    expect(db.__batchCommitCount).toBe(1)
  })

  it('skips a dispatch with an active monitor lease', async () => {
    const now = createMockTimestamp(1_000_000)
    const expiredDeadline = createMockTimestamp(500_000)
    const freshLease = 950_000 // within 120s of now
    const docs = [
      createMockDoc('d1', {
        acknowledgementDeadlineAt: expiredDeadline,
        monitorLeaseAt: freshLease,
        reportId: 'r1',
      }),
    ]

    const db = createMockDb({ docs })
    await dispatchTimeoutSweepCore(db, now)

    expect(db.__batchOps).toHaveLength(0)
    expect(db.__batchCommitCount).toBe(0)
  })

  it('skips a dispatch whose deadline has not expired', async () => {
    const now = createMockTimestamp(1_000_000)
    const futureDeadline = createMockTimestamp(1_500_000)
    const docs = [
      createMockDoc('d1', {
        acknowledgementDeadlineAt: futureDeadline,
        reportId: 'r1',
      }),
    ]

    const db = createMockDb({ docs })
    await dispatchTimeoutSweepCore(db, now)

    expect(db.__batchOps).toHaveLength(0)
    expect(db.__batchCommitCount).toBe(0)
  })

  it('commits mid-batch when MAX_BATCH_OPS is reached', async () => {
    const now = createMockTimestamp(1_000_000)
    const expiredDeadline = createMockTimestamp(500_000)
    const docs = Array.from({ length: 130 }, (_, i) =>
      createMockDoc(`d${String(i)}`, {
        acknowledgementDeadlineAt: expiredDeadline,
        reportId: `r${String(i)}`,
      }),
    )

    const db = createMockDb({ docs })
    await dispatchTimeoutSweepCore(db, now)

    // Each dispatch produces 2 ops (update + set). 130 dispatches = 260 ops.
    // MAX_BATCH_OPS = 250, so first batch commits at 250, second at 10.
    expect(db.__batchOps).toHaveLength(260)

    expect(db.__batchCommitCount).toBe(2)
  })

  it('times out a dispatch with an expired monitor lease', async () => {
    const now = createMockTimestamp(1_000_000)
    const expiredDeadline = createMockTimestamp(500_000)
    const expiredLease = 800_000 // more than 120s before now
    const docs = [
      createMockDoc('d1', {
        acknowledgementDeadlineAt: expiredDeadline,
        monitorLeaseAt: expiredLease,
        reportId: 'r1',
      }),
    ]

    const db = createMockDb({ docs })
    await dispatchTimeoutSweepCore(db, now)

    expect(db.__batchOps).toHaveLength(2)
    expect(db.__batchOps[0]).toMatchObject({ type: 'update', data: { status: 'timed_out' } })
  })
})
