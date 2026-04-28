import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const mockReplay = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../../services/hazard-signal-projector.js', () => ({
  replayHazardSignalProjection: mockReplay,
}))

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_opts: unknown, fn: unknown) => fn),
}))

import { hazardSignalExpirySweepCore } from '../../triggers/hazard-signal-expiry-sweep.js'

const NOW = 1713350400000

function createMockDb(expiredDocs: { id: string; validUntil: number }[] = []) {
  const updateFns = new Map<string, ReturnType<typeof vi.fn>>()
  for (const d of expiredDocs) {
    updateFns.set(d.id, vi.fn().mockResolvedValue(undefined))
  }

  const snapDocs = expiredDocs.map((d) => ({
    id: d.id,
    ref: { update: updateFns.get(d.id) },
  }))

  // Chain: collection().where().where().get() → snap with expired docs
  const getFn = vi.fn().mockResolvedValue({ docs: snapDocs })
  const whereFn = vi.fn()
  whereFn.mockReturnValue({ where: whereFn, get: getFn })
  const collectionFn = vi.fn(() => ({ where: whereFn }))

  return {
    collection: collectionFn,
    _updateFns: updateFns,
    _getFn: getFn,
  } as unknown as Firestore & { _updateFns: typeof updateFns; _getFn: typeof getFn }
}

beforeEach(() => {
  mockReplay.mockClear()
})

describe('hazardSignalExpirySweepCore', () => {
  it('marks expired active signals and calls replayHazardSignalProjection', async () => {
    const db = createMockDb([{ id: 'm-1', validUntil: NOW - 1 }])
    const result = await hazardSignalExpirySweepCore({ db, now: () => NOW })

    expect(result.expired).toBe(1)
    const updateFn = db._updateFns.get('m-1')!
    expect(updateFn).toHaveBeenCalledWith({ status: 'expired' })
    expect(mockReplay).toHaveBeenCalledWith({ db, now: NOW })
  })

  it('returns expired: 0 and skips replay when no signals have expired', async () => {
    const db = createMockDb([]) // no expired signals
    const result = await hazardSignalExpirySweepCore({ db, now: () => NOW })

    expect(result.expired).toBe(0)
    expect(mockReplay).not.toHaveBeenCalled()
  })

  it('marks multiple expired signals and calls replay once', async () => {
    const db = createMockDb([
      { id: 'm-1', validUntil: NOW - 1 },
      { id: 's-1', validUntil: NOW - 5000 },
    ])
    const result = await hazardSignalExpirySweepCore({ db, now: () => NOW })

    expect(result.expired).toBe(2)
    expect(mockReplay).toHaveBeenCalledOnce()
  })

  it('uses default now function when not provided', async () => {
    const db = createMockDb([])
    await hazardSignalExpirySweepCore({ db })
    expect(mockReplay).not.toHaveBeenCalled()
  })
})
