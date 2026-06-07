import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const mockWithIdempotency = vi.hoisted(() =>
  vi.fn(async (_db: Firestore, _opts: unknown, op: () => Promise<unknown>) => {
    return { result: await op(), fromCache: false }
  }),
)

vi.mock('../../../idempotency/guard.js', () => ({
  withIdempotency: mockWithIdempotency,
  IdempotencyInProgressError: class extends Error {},
  IdempotencyMismatchError: class extends Error {},
}))

import { mergeDuplicatesCore, inputSchema } from '../merge-duplicates.js'
import type { MergeDuplicatesActor } from '../merge-duplicates.js'

interface MockTx {
  get: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

function createMockDb(seed: {
  ops: Record<
    string,
    { municipalityId?: string; duplicateClusterId?: string; [key: string]: unknown }
  >
  reports: Record<string, { status: string; mediaRefs?: string[]; [key: string]: unknown }>
}) {
  const txGetFn = vi.fn((ref: { path?: string }) => {
    const path = ref.path ?? ''
    const opsMatch = /report_ops\/(.*)/.exec(path)
    if (opsMatch) {
      const data = seed.ops[opsMatch[1]!]
      return Promise.resolve({
        exists: !!data,
        data: () => data ?? null,
        id: opsMatch[1],
      })
    }
    const reportMatch = /reports\/(.*)/.exec(path)
    if (reportMatch) {
      const data = seed.reports[reportMatch[1]!]
      return Promise.resolve({
        exists: !!data,
        data: () => data ?? null,
        id: reportMatch[1],
      })
    }
    return Promise.resolve({ exists: false, data: () => null })
  })

  const txUpdateFn = vi.fn().mockResolvedValue(undefined)
  const txSetFn = vi.fn().mockResolvedValue(undefined)

  let eventDocCounter = 0

  const collectionFn = vi.fn((name: string) => ({
    doc: (id?: string) => {
      if (name === 'report_events' && id === undefined) {
        eventDocCounter++
        return {
          id: `event-${String(eventDocCounter)}`,
          path: 'report_events/auto',
          set: txSetFn,
        }
      }
      return {
        id: id ?? 'auto-id',
        path: `${name}/${id ?? 'auto'}`,
        update: txUpdateFn,
        set: txSetFn,
      }
    },
  }))

  const runTransaction = vi.fn(async (callback: (tx: MockTx) => Promise<unknown>) =>
    callback({
      get: txGetFn,
      update: txUpdateFn,
      set: txSetFn,
    }),
  )

  return {
    collection: collectionFn,
    runTransaction,
    _txGet: txGetFn,
    _txUpdate: txUpdateFn,
    _txSet: txSetFn,
  } as unknown as Firestore & {
    _txGet: typeof txGetFn
    _txUpdate: typeof txUpdateFn
    _txSet: typeof txSetFn
  }
}

const baseActor: MergeDuplicatesActor = {
  uid: 'admin-1',
  claims: {
    role: 'municipal_admin',
    municipalityId: 'daet',
    active: true,
    auth_time: 1713350400,
  },
}

describe('mergeDuplicates inputSchema', () => {
  it('accepts well-formed input', () => {
    const result = inputSchema.parse({
      primaryReportId: 'report-1',
      duplicateReportIds: ['report-2', 'report-3'],
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
    expect(result).toEqual({
      primaryReportId: 'report-1',
      duplicateReportIds: ['report-2', 'report-3'],
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('rejects when primary is in duplicate list', () => {
    expect(() =>
      inputSchema.parse({
        primaryReportId: 'report-1',
        duplicateReportIds: ['report-1'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toThrow('primaryReportId cannot be in duplicateReportIds')
  })

  it('rejects duplicate IDs that are not unique', () => {
    expect(() =>
      inputSchema.parse({
        primaryReportId: 'report-1',
        duplicateReportIds: ['report-2', 'report-2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    ).toThrow('duplicateReportIds must be unique')
  })
})

describe('mergeDuplicatesCore', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockWithIdempotency.mockClear()
  })

  it('rejects non-admin callers', async () => {
    const citizenActor: MergeDuplicatesActor = {
      uid: 'citizen-1',
      claims: {
        role: 'citizen',
        active: true,
        auth_time: 1713350400,
      },
    }

    const result = await mergeDuplicatesCore(
      {} as Firestore,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      citizenActor,
    )

    expect(result).toEqual({ success: false, errorCode: 'permission-denied' })
  })

  it('rejects inactive admin', async () => {
    const inactiveActor: MergeDuplicatesActor = {
      uid: 'admin-1',
      claims: {
        role: 'municipal_admin',
        municipalityId: 'daet',
        active: false,
        auth_time: 1713350400,
      },
    }

    const result = await mergeDuplicatesCore(
      {} as Firestore,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      inactiveActor,
    )

    expect(result).toEqual({ success: false, errorCode: 'permission-denied' })
  })

  it('rejects when report_ops docs are missing', async () => {
    mockDb = createMockDb({
      ops: {},
      reports: {
        r1: { status: 'new' },
        r2: { status: 'new' },
      },
    })

    const result = await mergeDuplicatesCore(
      mockDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      baseActor,
    )

    expect(result).toEqual({ success: false, errorCode: 'not-found' })
  })

  it('rejects when reports are from different municipalities', async () => {
    mockDb = createMockDb({
      ops: {
        r1: { municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
        r2: { municipalityId: 'basud', duplicateClusterId: 'cluster-1' },
      },
      reports: {
        r1: { status: 'new' },
        r2: { status: 'new' },
      },
    })

    const result = await mergeDuplicatesCore(
      mockDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      baseActor,
    )

    expect(result).toEqual({ success: false, errorCode: 'invalid-argument' })
  })

  it('rejects when reports do not share a duplicateClusterId', async () => {
    mockDb = createMockDb({
      ops: {
        r1: { municipalityId: 'daet', duplicateClusterId: 'cluster-a' },
        r2: { municipalityId: 'daet', duplicateClusterId: 'cluster-b' },
      },
      reports: {
        r1: { status: 'new' },
        r2: { status: 'new' },
      },
    })

    const result = await mergeDuplicatesCore(
      mockDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      baseActor,
    )

    expect(result).toEqual({ success: false, errorCode: 'failed-precondition' })
  })

  it('succeeds and merges duplicates for valid input', async () => {
    mockDb = createMockDb({
      ops: {
        r1: { municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
        r2: { municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
      },
      reports: {
        r1: { status: 'new', mediaRefs: ['media-a'] },
        r2: { status: 'new', mediaRefs: ['media-b'] },
      },
    })

    const result = await mergeDuplicatesCore(
      mockDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      baseActor,
    )

    expect(result).toEqual({ success: true, mergedCount: 1 })

    // Verify primary report updated with merged mediaRefs
    const primaryUpdate = mockDb._txUpdate.mock.calls.find(
      (call: unknown[]) => (call[0] as { path?: string }).path === 'reports/r1',
    )
    expect(primaryUpdate).toBeDefined()
    expect(primaryUpdate![1]).toMatchObject({
      mediaRefs: expect.arrayContaining(['media-a', 'media-b']),
    })

    // Verify duplicate marked as merged
    const dupUpdate = mockDb._txUpdate.mock.calls.find(
      (call: unknown[]) => (call[0] as { path?: string }).path === 'reports/r2',
    )
    expect(dupUpdate).toBeDefined()
    expect(dupUpdate![1]).toMatchObject({
      status: 'merged_as_duplicate',
      mergedInto: 'r1',
    })

    // Verify event created
    expect(mockDb._txSet).toHaveBeenCalled()
  })

  it('rejects when admin is not in the same municipality', async () => {
    const otherMuniActor: MergeDuplicatesActor = {
      uid: 'admin-1',
      claims: {
        role: 'municipal_admin',
        municipalityId: 'basud',
        active: true,
        auth_time: 1713350400,
      },
    }

    mockDb = createMockDb({
      ops: {
        r1: { municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
        r2: { municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
      },
      reports: {
        r1: { status: 'new' },
        r2: { status: 'new' },
      },
    })

    const result = await mergeDuplicatesCore(
      mockDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      otherMuniActor,
    )

    expect(result).toEqual({ success: false, errorCode: 'permission-denied' })
  })

  it('rejects when reports are missing', async () => {
    mockDb = createMockDb({
      ops: {
        r1: { municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
        r2: { municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
      },
      reports: {},
    })

    const result = await mergeDuplicatesCore(
      mockDb,
      {
        primaryReportId: 'r1',
        duplicateReportIds: ['r2'],
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      baseActor,
    )

    expect(result).toEqual({ success: false, errorCode: 'not-found' })
  })
})
