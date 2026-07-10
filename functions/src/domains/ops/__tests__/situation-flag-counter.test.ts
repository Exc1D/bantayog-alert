import { describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const { mockLog, mockRunTransaction } = vi.hoisted(() => ({
  mockLog: vi.fn(),
  mockRunTransaction: vi.fn(),
}))

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn((_opts: unknown, fn: unknown) => fn),
}))

vi.mock('../../../admin-init.js', () => ({
  adminDb: {
    collection: vi.fn(() => ({ doc: vi.fn((id: string) => ({ id })) })),
    runTransaction: mockRunTransaction,
  },
}))

vi.mock('@bantayog/shared-validators', async () => {
  const actual = await vi.importActual<typeof import('@bantayog/shared-validators')>(
    '@bantayog/shared-validators',
  )
  return {
    ...actual,
    logDimension: vi.fn(() => mockLog),
  }
})

import { situationFlagCounterCore, situationFlagCounter } from '../situation-flag-counter.js'

function createMockDb(seed: Record<string, Record<string, unknown> | undefined>) {
  const update = vi.fn()
  const doc = vi.fn((id: string) => ({ id }))
  const collection = vi.fn(() => ({ doc }))
  const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      get: (ref: { id: string }) =>
        Promise.resolve({
          exists: seed[ref.id] !== undefined,
          data: () => seed[ref.id],
        }),
      update,
    }
    await fn(tx)
  })
  return { collection, runTransaction, _update: update } as unknown as Firestore & {
    _update: typeof update
  }
}

describe('situationFlagCounterCore', () => {
  it('increments the parent reportedCount when a flag is created', async () => {
    const db = createMockDb({ 'sit-1': { reportedCount: 2 } })

    await situationFlagCounterCore(db, 'sit-1')

    expect(db._update).toHaveBeenCalledWith(expect.objectContaining({ id: 'sit-1' }), {
      reportedCount: 3,
    })
  })

  it('treats a missing or invalid count as zero', async () => {
    const db = createMockDb({ 'sit-1': { body: 'no count field' } })

    await situationFlagCounterCore(db, 'sit-1')

    expect(db._update).toHaveBeenCalledWith(expect.objectContaining({ id: 'sit-1' }), {
      reportedCount: 1,
    })
  })

  it('does nothing when the parent update no longer exists', async () => {
    const db = createMockDb({})

    await situationFlagCounterCore(db, 'sit-gone')

    expect(db._update).not.toHaveBeenCalled()
  })
})

describe('situationFlagCounter trigger', () => {
  const handler = situationFlagCounter as unknown as (event: {
    params: { updateId: string; reportId: string }
  }) => Promise<void>

  it('logs the failure and rethrows when the transaction fails', async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error('firestore unavailable'))

    await expect(handler({ params: { updateId: 'sit-1', reportId: 'report-1' } })).rejects.toThrow(
      'firestore unavailable',
    )

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'ERROR',
        code: 'situation.flag_counter_failed',
        data: { updateId: 'sit-1', error: 'firestore unavailable' },
      }),
    )
  })
})
