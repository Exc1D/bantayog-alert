import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

let mockDb: Firestore

const mockReplayHazardSignalProjection = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockPagasaSignalPollCore = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: 'updated', scraperDegraded: false }),
)

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

vi.mock('../../services/hazard-signal-projector.js', () => ({
  replayHazardSignalProjection: mockReplayHazardSignalProjection,
}))

vi.mock('../../triggers/pagasa-signal-poll.js', () => ({
  pagasaSignalPollCore: mockPagasaSignalPollCore,
}))

function createMockDb(deadLetters: { category: string; payload: unknown }[]) {
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

import { replaySignalDeadLetter } from '../../callables/replay-signal-dead-letter.js'

beforeEach(() => {
  mockReplayHazardSignalProjection.mockClear()
  mockPagasaSignalPollCore.mockClear()
  mockPagasaSignalPollCore.mockResolvedValue({ status: 'updated', scraperDegraded: false })
})

describe('replaySignalDeadLetter', () => {
  it('replays hazard signal projection dead letters for provincial superadmins', async () => {
    mockDb = createMockDb([
      { category: 'hazard_signal_projection', payload: { signalIds: ['sig-1'] } },
    ])
    const invokeReplay = replaySignalDeadLetter as unknown as (request: {
      auth: {
        uid: string
        token: { role: string }
      }
      data: { category: 'hazard_signal_projection' }
    }) => Promise<{ replayed: number }>

    const result = await invokeReplay({
      auth: {
        uid: 'super-1',
        token: { role: 'provincial_superadmin' },
      },
      data: { category: 'hazard_signal_projection' },
    })

    expect(result).toEqual({ replayed: 1 })
    expect(mockReplayHazardSignalProjection).toHaveBeenCalledOnce()
    expect(mockReplayHazardSignalProjection).toHaveBeenCalledWith({
      db: mockDb,
      now: expect.any(Number),
    })
    expect(
      (mockDb as unknown as { _updateFn: ReturnType<typeof vi.fn> })._updateFn,
    ).toHaveBeenCalledWith({
      resolvedAt: expect.any(Number),
      resolvedBy: 'super-1',
    })
  })

  it('replays pagasa scraper dead letters with replayable html payloads', async () => {
    const db = createMockDb([{ category: 'pagasa_scraper', payload: '<html>TCWS #3 Daet</html>' }])
    mockDb = db

    const invokeReplay = replaySignalDeadLetter as unknown as (request: {
      auth: {
        uid: string
        token: { role: string }
      }
      data: { category: 'pagasa_scraper' }
    }) => Promise<{ replayed: number }>

    const result = await invokeReplay({
      auth: {
        uid: 'super-1',
        token: { role: 'provincial_superadmin' },
      },
      data: { category: 'pagasa_scraper' },
    })

    expect(result).toEqual({ replayed: 1 })
    expect(mockPagasaSignalPollCore).toHaveBeenCalledOnce()
    expect(db._updateFn).toHaveBeenCalledWith({
      resolvedAt: expect.any(Number),
      resolvedBy: 'super-1',
    })
  })

  it('rejects non-superadmin callers', async () => {
    mockDb = createMockDb([])

    const invokeReplay = replaySignalDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: { category: string }
    }) => Promise<{ replayed: number }>

    await expect(
      invokeReplay({
        auth: {
          uid: 'super-1',
          token: { role: 'municipal_admin' },
        },
        data: { category: 'hazard_signal_projection' },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws failed-precondition for unreplayable payload', async () => {
    mockDb = createMockDb([{ category: 'pagasa_scraper', payload: {} }])

    const invokeReplay = replaySignalDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: { category: 'pagasa_scraper' }
    }) => Promise<{ replayed: number }>

    await expect(
      invokeReplay({
        auth: {
          uid: 'super-1',
          token: { role: 'provincial_superadmin' },
        },
        data: { category: 'pagasa_scraper' },
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('does not mark resolved when pagasaSignalPollCore returns non-updated', async () => {
    const db = createMockDb([{ category: 'pagasa_scraper', payload: '<html>TCWS #3 Daet</html>' }])
    mockDb = db
    mockPagasaSignalPollCore.mockResolvedValue({ status: 'no-change', scraperDegraded: false })

    const invokeReplay = replaySignalDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: { category: 'pagasa_scraper' }
    }) => Promise<{ replayed: number }>

    const result = await invokeReplay({
      auth: {
        uid: 'super-1',
        token: { role: 'provincial_superadmin' },
      },
      data: { category: 'pagasa_scraper' },
    })

    expect(result).toEqual({ replayed: 0 })
    expect(db._updateFn).not.toHaveBeenCalled()
  })

  it('rejects unsupported categories with invalid-argument', async () => {
    mockDb = createMockDb([])

    const invokeReplay = replaySignalDeadLetter as unknown as (request: {
      auth: { uid: string; token: { role: string } }
      data: { category: string }
    }) => Promise<{ replayed: number }>

    await expect(
      invokeReplay({
        auth: {
          uid: 'super-1',
          token: { role: 'provincial_superadmin' },
        },
        data: { category: 'unknown' },
      }),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})
