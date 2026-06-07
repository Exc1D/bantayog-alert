import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const mockWithIdempotency = vi.hoisted(() =>
  vi.fn(async (_db: Firestore, _opts: unknown, op: () => Promise<unknown>) => {
    return { result: await op(), fromCache: false }
  }),
)
const mockCheckRateLimit = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ allowed: true, retryAfterSeconds: 0 })),
)
const mockLogDimension = vi.hoisted(() => vi.fn(() => vi.fn()))

vi.mock('../../../idempotency/guard.js', () => ({
  withIdempotency: mockWithIdempotency,
}))
vi.mock('../shared/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@bantayog/shared-validators', async () => {
  const actual = await vi.importActual<typeof import('@bantayog/shared-validators')>(
    '@bantayog/shared-validators',
  )
  return {
    ...actual,
    logDimension: mockLogDimension,
  }
})

import {
  redispatchReportSchema,
  redispatchReportCore,
  type RedispatchReportCoreDeps,
} from '../redispatch-report.js'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

interface MockTx {
  get: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

interface MockDbSeed {
  oldDispatch?: {
    status: string
    reportId: string
    assignedTo?: { uid: string; agencyId: string; municipalityId: string }
    [key: string]: unknown
  }
  report?: {
    status: string
    municipalityId: string
    severityDerived?: string
    [key: string]: unknown
  }
  responder?: {
    agencyId: string
    municipalityId: string
    isActive: boolean
    [key: string]: unknown
  }
}

function createMockDb(seed?: MockDbSeed) {
  const txGetFn = vi.fn((ref: { path?: string }) => {
    if (seed?.oldDispatch && ref.path?.startsWith('dispatches/')) {
      return Promise.resolve({
        exists: true,
        data: () => seed.oldDispatch,
        id: 'old-dispatch-1',
      })
    }
    if (seed?.report && ref.path?.startsWith('reports/')) {
      return Promise.resolve({
        exists: true,
        data: () => seed.report,
        id: seed.report.reportId ?? 'report-1',
      })
    }
    if (seed?.responder && ref.path?.startsWith('responders/')) {
      return Promise.resolve({
        exists: true,
        data: () => seed.responder,
        id: 'responder-1',
      })
    }
    return Promise.resolve({ exists: false, data: () => null })
  })
  const txUpdateFn = vi.fn().mockResolvedValue(undefined)
  const txSetFn = vi.fn().mockResolvedValue(undefined)

  let dispatchDocCounter = 0
  let reportEventDocCounter = 0

  const docFn = vi.fn((id?: string) => {
    const isDispatch = id?.startsWith('report-') && id.includes('_')
    if (isDispatch) {
      dispatchDocCounter++
      return {
        id: id ?? `dispatch-${String(dispatchDocCounter)}`,
        path: `dispatches/${id ?? 'auto'}`,
        get: vi.fn().mockResolvedValue({
          exists: dispatchDocCounter > 1,
          data: () => ({}),
        }),
        update: txUpdateFn,
        set: txSetFn,
      }
    }
    if (id === undefined) {
      reportEventDocCounter++
      return {
        id: `event-${String(reportEventDocCounter)}`,
        path: 'report_events/auto',
        set: txSetFn,
      }
    }
    return {
      id: id || 'auto-id',
      path: `reports/${id}`,
      update: txUpdateFn,
      set: txSetFn,
    }
  })

  const collectionFn = vi.fn((name: string) => ({
    doc: (id?: string) => {
      const d = docFn(id)
      if (id !== undefined) {
        d.path = `${name}/${id}`
      }
      return d
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
    _collectionFn: collectionFn,
  } as unknown as Firestore & {
    _txGet: typeof txGetFn
    _txUpdate: typeof txUpdateFn
    _txSet: typeof txSetFn
    _collectionFn: typeof collectionFn
    runTransaction: typeof runTransaction
  }
}

const mockTimestamp = {
  toMillis: () => 1713350400000,
}

describe('redispatchReportSchema', () => {
  it('accepts a well-formed request', () => {
    const result = redispatchReportSchema.parse({
      oldDispatchId: 'dispatch-abc-123',
      newResponderUid: 'responder-xyz-789',
      reason: 'Original responder unavailable',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
    expect(result).toEqual({
      oldDispatchId: 'dispatch-abc-123',
      newResponderUid: 'responder-xyz-789',
      reason: 'Original responder unavailable',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('rejects empty oldDispatchId', () => {
    expect(() =>
      redispatchReportSchema.parse({
        oldDispatchId: '',
        newResponderUid: 'responder-1',
        reason: 'Test',
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })

  it('rejects non-UUID idempotencyKey', () => {
    expect(() =>
      redispatchReportSchema.parse({
        oldDispatchId: 'dispatch-1',
        newResponderUid: 'responder-1',
        reason: 'Test',
        idempotencyKey: 'not-a-uuid',
      }),
    ).toThrow()
  })

  it('rejects reason over 500 chars', () => {
    expect(() =>
      redispatchReportSchema.parse({
        oldDispatchId: 'dispatch-1',
        newResponderUid: 'responder-1',
        reason: 'x'.repeat(501),
        idempotencyKey: crypto.randomUUID(),
      }),
    ).toThrow()
  })
})

describe('redispatchReportCore', () => {
  let mockDb: ReturnType<typeof createMockDb>

  const baseDeps: Omit<RedispatchReportCoreDeps, 'oldDispatchId' | 'newResponderUid' | 'reason'> = {
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
    actor: {
      uid: 'admin-1',
      claims: { role: 'municipal_admin', municipalityId: 'daet' },
    },
    now: mockTimestamp as unknown as import('firebase-admin/firestore').Timestamp,
  }

  beforeEach(() => {
    mockDb = createMockDb()
    mockWithIdempotency.mockClear()
    mockCheckRateLimit.mockClear()
    mockLogDimension.mockClear()
  })

  it('throws when old dispatch is not found', async () => {
    await expect(
      redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'missing',
        newResponderUid: 'responder-1',
        reason: 'Test',
      }),
    ).rejects.toThrow(BantayogError)

    try {
      await redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'missing',
        newResponderUid: 'responder-1',
        reason: 'Test',
      })
    } catch (err) {
      expect(err).toBeInstanceOf(BantayogError)
      expect((err as BantayogError).code).toBe(BantayogErrorCode.NOT_FOUND)
      expect((err as BantayogError).message).toContain('Old dispatch not found')
    }
  })

  it('throws when old dispatch is not in terminal state', async () => {
    mockDb = createMockDb({
      oldDispatch: {
        status: 'pending',
        reportId: 'report-1',
        assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
      },
    })

    await expect(
      redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'old-dispatch-1',
        newResponderUid: 'responder-2',
        reason: 'Test',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof BantayogError)) return false
      return (
        err.code === BantayogErrorCode.FAILED_PRECONDITION &&
        err.message.includes('Cannot redispatch from status pending')
      )
    })
  })

  it('throws when report is not found', async () => {
    mockDb = createMockDb({
      oldDispatch: {
        status: 'declined',
        reportId: 'missing-report',
        assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
      },
    })

    await expect(
      redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'old-dispatch-1',
        newResponderUid: 'responder-2',
        reason: 'Test',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof BantayogError)) return false
      return err.code === BantayogErrorCode.NOT_FOUND && err.message.includes('Report not found')
    })
  })

  it('throws when report is not verified', async () => {
    mockDb = createMockDb({
      oldDispatch: {
        status: 'declined',
        reportId: 'report-1',
        assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
      },
      report: {
        status: 'new',
        municipalityId: 'daet',
        reportId: 'report-1',
      },
    })

    await expect(
      redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'old-dispatch-1',
        newResponderUid: 'responder-2',
        reason: 'Test',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof BantayogError)) return false
      return (
        err.code === BantayogErrorCode.FAILED_PRECONDITION &&
        err.message.includes('Report must be verified')
      )
    })
  })

  it('throws when responder is not found', async () => {
    mockDb = createMockDb({
      oldDispatch: {
        status: 'declined',
        reportId: 'report-1',
        assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
      },
      report: {
        status: 'verified',
        municipalityId: 'daet',
        reportId: 'report-1',
        severityDerived: 'high',
      },
    })

    await expect(
      redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'old-dispatch-1',
        newResponderUid: 'missing-responder',
        reason: 'Test',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof BantayogError)) return false
      return err.code === BantayogErrorCode.NOT_FOUND && err.message.includes('Responder not found')
    })
  })

  it('throws when responder is not active', async () => {
    mockDb = createMockDb({
      oldDispatch: {
        status: 'declined',
        reportId: 'report-1',
        assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
      },
      report: {
        status: 'verified',
        municipalityId: 'daet',
        reportId: 'report-1',
        severityDerived: 'high',
      },
      responder: {
        agencyId: 'bfp',
        municipalityId: 'daet',
        isActive: false,
      },
    })

    await expect(
      redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'old-dispatch-1',
        newResponderUid: 'responder-2',
        reason: 'Test',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof BantayogError)) return false
      return (
        err.code === BantayogErrorCode.INVALID_STATUS_TRANSITION &&
        err.message.includes('Responder is not active')
      )
    })
  })

  it('throws when responder is in different municipality', async () => {
    mockDb = createMockDb({
      oldDispatch: {
        status: 'declined',
        reportId: 'report-1',
        assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
      },
      report: {
        status: 'verified',
        municipalityId: 'daet',
        reportId: 'report-1',
        severityDerived: 'high',
      },
      responder: {
        agencyId: 'bfp',
        municipalityId: 'basud',
        isActive: true,
      },
    })

    await expect(
      redispatchReportCore(mockDb, {
        ...baseDeps,
        oldDispatchId: 'old-dispatch-1',
        newResponderUid: 'responder-2',
        reason: 'Test',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof BantayogError)) return false
      return (
        err.code === BantayogErrorCode.FORBIDDEN &&
        err.message.includes('Responder not in report municipality')
      )
    })
  })

  it('succeeds and creates new dispatch for valid redispatch', async () => {
    mockDb = createMockDb({
      oldDispatch: {
        status: 'declined',
        reportId: 'report-1',
        assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
      },
      report: {
        status: 'verified',
        municipalityId: 'daet',
        reportId: 'report-1',
        severityDerived: 'high',
      },
      responder: {
        agencyId: 'mdrrmo',
        municipalityId: 'daet',
        isActive: true,
      },
    })

    const result = await redispatchReportCore(mockDb, {
      ...baseDeps,
      oldDispatchId: 'old-dispatch-1',
      newResponderUid: 'responder-2',
      reason: 'Original responder declined',
    })

    expect(result).toEqual({
      newDispatchId: 'report-1_responder-2',
      status: 'pending',
      reportId: 'report-1',
    })

    // Verify old dispatch was updated
    expect(mockDb._txUpdate).toHaveBeenCalled()
    const oldDispatchUpdate = mockDb._txUpdate.mock.calls.find(
      (call: unknown[]) => (call[0] as { path?: string }).path === 'dispatches/old-dispatch-1',
    )
    expect(oldDispatchUpdate).toBeDefined()

    // Verify report was updated to assigned
    const reportUpdate = mockDb._txUpdate.mock.calls.find(
      (call: unknown[]) => (call[0] as { path?: string }).path === 'reports/report-1',
    )
    expect(reportUpdate).toBeDefined()
    expect(reportUpdate![1]).toMatchObject({
      status: 'assigned',
      currentDispatchId: 'report-1_responder-2',
    })

    // Verify dispatch event was created
    expect(mockDb._txSet).toHaveBeenCalled()
  })
})
