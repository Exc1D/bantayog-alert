import { describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn((_opts: unknown, fn: unknown) => fn),
}))

import { situationFlagCounterCore } from '../situation-flag-counter.js'

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
