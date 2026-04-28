import { describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const mockQuery = vi.hoisted(() => vi.fn())

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: class {
    query = mockQuery
  },
}))

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_opts: unknown, fn: unknown) => fn),
}))

function createMockDb() {
  const setFn = vi.fn().mockResolvedValue(undefined)
  const docFn = vi.fn(() => ({ set: setFn }))
  const db = {
    doc: docFn,
  } as unknown as Firestore
  return { db, setFn }
}

import { costSnapshotWriterCore } from '../../triggers/cost-snapshot-writer.js'

describe('costSnapshotWriterCore', () => {
  it('writes the merged cost snapshot and marks anomalies when the day exceeds baseline', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ totalCost: '180' }]])
      .mockResolvedValueOnce([[{ totalCost: 100 }]])

    const { db, setFn } = createMockDb()
    const result = await costSnapshotWriterCore(
      db,
      { query: mockQuery },
      { now: () => 1713350400000 },
    )

    expect(result).toEqual({ anomaly: true, todayCost: 180, baselineCost: 100 })
    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        costSnapshot: expect.objectContaining({
          todayCost: 180,
          baselineCost: 100,
          anomaly: true,
          recordedAt: 1713350400000,
        }),
      }),
      { merge: true },
    )
  })

  it('treats missing cost rows as zero and does not flag an anomaly', async () => {
    mockQuery.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]])

    const { db } = createMockDb()
    const result = await costSnapshotWriterCore(
      db,
      { query: mockQuery },
      { now: () => 1713350400000 },
    )

    expect(result).toEqual({ anomaly: false, todayCost: 0, baselineCost: 0 })
  })
})
