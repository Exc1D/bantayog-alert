import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const mockWithIdempotency = vi.hoisted(() =>
  vi.fn(async (_db: Firestore, _opts: unknown, op: () => Promise<unknown>) => {
    return { result: await op(), fromCache: false }
  }),
)
const mockLogDimension = vi.hoisted(() => vi.fn(() => vi.fn()))
const mockIsValidReportTransition = vi.hoisted(() => vi.fn(() => true))

vi.mock('../../../idempotency/guard.js', () => ({
  withIdempotency: mockWithIdempotency,
}))
vi.mock('@bantayog/shared-validators', async () => {
  const actual = await vi.importActual<typeof import('@bantayog/shared-validators')>(
    '@bantayog/shared-validators',
  )
  return {
    ...actual,
    logDimension: mockLogDimension,
    isValidReportTransition: mockIsValidReportTransition,
  }
})

import { closeReportRequestSchema, closeReportCore } from '../close-report.js'

interface MockTx {
  get: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

interface MockDbSeed {
  report?: { reportId: string; status: string; municipalityId: string; [key: string]: unknown }
  dispatch?: { dispatchId: string; status: string; [key: string]: unknown }
  reportOps?: { reportId: string; [key: string]: unknown }
  [key: string]: unknown
}

function createMockDb(seed?: MockDbSeed) {
  const reportSeed =
    seed?.report ??
    (seed && typeof seed.reportId === 'string'
      ? (Object.fromEntries(
          Object.entries(seed).filter(([k]) => !['report', 'dispatch', 'reportOps'].includes(k)),
        ) as MockDbSeed['report'])
      : undefined)

  const txGetFn = vi.fn((ref: { path?: string }) => {
    if (reportSeed && ref.path === `reports/${reportSeed.reportId}`) {
      return Promise.resolve({
        exists: true,
        data: () => ({ ...reportSeed }),
      })
    }
    if (seed?.dispatch && ref.path === `dispatches/${seed.dispatch.dispatchId}`) {
      return Promise.resolve({
        exists: true,
        data: () => ({ ...seed.dispatch }),
      })
    }
    if (seed?.reportOps && ref.path === `report_ops/${seed.reportOps.reportId}`) {
      return Promise.resolve({
        exists: true,
        data: () => ({ ...seed.reportOps }),
      })
    }
    return Promise.resolve({ exists: false, data: () => null })
  })
  const txUpdateFn = vi.fn().mockResolvedValue(undefined)
  const txSetFn = vi.fn().mockResolvedValue(undefined)

  let eventDocCounter = 0
  const docFn = vi.fn((id?: string) => ({
    path: id?.includes('/') ? id : `reports/${id ?? 'auto-id'}`,
    get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
    update: txUpdateFn,
    set: txSetFn,
  }))

  const collectionFn = vi.fn((name: string) => ({
    doc: (id?: string) => {
      if (name === 'report_events' && id === undefined) {
        // Called as collection('report_events').doc() — auto-id
        eventDocCounter++
        return {
          id: `event-${String(eventDocCounter)}`,
          path: 'report_events/event-new',
          set: txSetFn,
        }
      }
      const d = docFn(id)
      d.path = `${name}/${id ?? 'auto-id'}`
      return d
    },
    where: vi.fn(() => ({ where: vi.fn(), get: vi.fn().mockResolvedValue({ docs: [] }) })),
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

describe('closeReportRequestSchema', () => {
  it('accepts well-formed request', () => {
    const result = closeReportRequestSchema.parse({
      reportId: 'report-abc123',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      closureSummary: 'Resolved by municipal admin.',
    })
    expect(result).toEqual({
      reportId: 'report-abc123',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      closureSummary: 'Resolved by municipal admin.',
    })
  })

  it('rejects missing reportId', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toThrow()
  })

  it('rejects non-UUID idempotencyKey', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        reportId: 'report-abc123',
        idempotencyKey: 'not-a-uuid',
        closureSummary: 'Resolved.',
      }),
    ).toThrow()
  })

  it('rejects whitespace-only closureSummary', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        reportId: 'report-abc123',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        closureSummary: '   ',
      }),
    ).toThrow()
  })

  it('rejects too-long closureSummary (> 2000 chars)', () => {
    expect(() =>
      closeReportRequestSchema.parse({
        reportId: 'report-abc123',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        closureSummary: 'x'.repeat(2001),
      }),
    ).toThrow()
  })
})

describe('closeReportCore', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockDb = createMockDb()
    mockWithIdempotency.mockClear()
    mockLogDimension.mockClear()
    mockIsValidReportTransition.mockClear()
  })

  it('transitions resolved report to closed and writes event', async () => {
    mockDb = createMockDb({
      reportId: 'rep-1',
      status: 'resolved',
      municipalityId: 'daet',
    })

    const result = await closeReportCore(mockDb, {
      reportId: 'rep-1',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    expect(result.status).toBe('closed')
    expect(result.reportId).toBe('rep-1')

    // Report updated
    expect(mockDb._txUpdate).toHaveBeenCalled()
    const updateCall = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'reports/rep-1',
    )
    expect(updateCall).toBeDefined()
    expect((updateCall![1] as Record<string, unknown>).status).toBe('closed')
    expect((updateCall![1] as Record<string, unknown>).lastStatusAt).toBe(1713350400000)
    expect((updateCall![1] as Record<string, unknown>).lastStatusBy).toBe('admin-1')

    // Event written
    expect(mockDb._txSet).toHaveBeenCalled()
    const eventCall = mockDb._txSet.mock.calls.find(
      (c: unknown[]) =>
        (c[0] as { path?: string }).path?.startsWith('report_events/') ??
        (c[0] as { id?: string }).id?.startsWith('event-'),
    )
    expect(eventCall).toBeDefined()
    const eventData = eventCall![1] as Record<string, unknown>
    expect(eventData.from).toBe('resolved')
    expect(eventData.to).toBe('closed')
    expect(eventData.reportId).toBe('rep-1')
    expect(eventData.actor).toBe('admin-1')
    expect(eventData.actorRole).toBe('municipal_admin')
  })

  it('stores closureSummary when provided', async () => {
    mockDb = createMockDb({
      reportId: 'rep-2',
      status: 'resolved',
      municipalityId: 'daet',
    })

    await closeReportCore(mockDb, {
      reportId: 'rep-2',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      closureSummary: 'All responders stood down.',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    const updateCall = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'reports/rep-2',
    )
    expect((updateCall![1] as Record<string, unknown>).closureSummary).toBe(
      'All responders stood down.',
    )
  })

  it('omits closureSummary key when undefined', async () => {
    mockDb = createMockDb({
      reportId: 'rep-3',
      status: 'resolved',
      municipalityId: 'daet',
    })

    await closeReportCore(mockDb, {
      reportId: 'rep-3',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    const updateCall = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'reports/rep-3',
    )
    expect(Object.prototype.hasOwnProperty.call(updateCall![1], 'closureSummary')).toBe(false)
  })

  it('throws NOT_FOUND when report does not exist', async () => {
    mockDb = createMockDb() // no seed

    await expect(
      closeReportCore(mockDb, {
        reportId: 'missing-report',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        actor: {
          uid: 'admin-1',
          claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
        },
        now: {
          toMillis: () => 1713350400000,
        } as unknown as import('firebase-admin/firestore').Timestamp,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws FORBIDDEN when report is in a different municipality', async () => {
    mockDb = createMockDb({
      reportId: 'rep-4',
      status: 'resolved',
      municipalityId: 'mercedes',
    })

    await expect(
      closeReportCore(mockDb, {
        reportId: 'rep-4',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        actor: {
          uid: 'admin-1',
          claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
        },
        now: {
          toMillis: () => 1713350400000,
        } as unknown as import('firebase-admin/firestore').Timestamp,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FAILED_PRECONDITION when report is not resolved', async () => {
    mockDb = createMockDb({
      reportId: 'rep-5',
      status: 'verified',
      municipalityId: 'daet',
    })

    await expect(
      closeReportCore(mockDb, {
        reportId: 'rep-5',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        actor: {
          uid: 'admin-1',
          claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
        },
        now: {
          toMillis: () => 1713350400000,
        } as unknown as import('firebase-admin/firestore').Timestamp,
      }),
    ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
  })

  it('allows resolved→closed through the isValidReportTransition guard', async () => {
    // The real transition table includes resolved→closed, so this verifies
    // both the FAILED_PRECONDITION guard (from === 'resolved') and the
    // isValidReportTransition guard pass for the normal happy path.
    mockDb = createMockDb({
      reportId: 'rep-6',
      status: 'resolved',
      municipalityId: 'daet',
    })

    const result = await closeReportCore(mockDb, {
      reportId: 'rep-6',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    expect(result.status).toBe('closed')
  })

  it('throws INVALID_STATUS_TRANSITION when transition is invalid', async () => {
    mockIsValidReportTransition.mockReturnValueOnce(false)
    mockDb = createMockDb({
      reportId: 'rep-invalid-transition',
      status: 'resolved',
      municipalityId: 'daet',
    })

    await expect(
      closeReportCore(mockDb, {
        reportId: 'rep-invalid-transition',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        actor: {
          uid: 'admin-1',
          claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
        },
        now: {
          toMillis: () => 1713350400000,
        } as unknown as import('firebase-admin/firestore').Timestamp,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })

  it('passes correct idempotency key to withIdempotency', async () => {
    mockDb = createMockDb({
      reportId: 'rep-7',
      status: 'resolved',
      municipalityId: 'daet',
    })

    await closeReportCore(mockDb, {
      reportId: 'rep-7',
      idempotencyKey: 'my-unique-key-123',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    expect(mockWithIdempotency).toHaveBeenCalledTimes(1)
    const callArgs = mockWithIdempotency.mock.calls[0]!
    expect((callArgs[1] as { key?: string }).key).toBe('closeReport:admin-1:my-unique-key-123')
  })

  it('falls back to municipal_admin actorRole when claims.role is undefined', async () => {
    mockDb = createMockDb({
      reportId: 'rep-8',
      status: 'resolved',
      municipalityId: 'daet',
    })

    await closeReportCore(mockDb, {
      reportId: 'rep-8',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'admin-super',
        claims: { municipalityId: 'daet', active: true }, // role intentionally omitted
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    const eventCall = mockDb._txSet.mock.calls.find(
      (c: unknown[]) =>
        (c[0] as { path?: string }).path?.startsWith('report_events/') ??
        (c[0] as { id?: string }).id?.startsWith('event-'),
    )
    expect((eventCall![1] as Record<string, unknown>).actorRole).toBe('municipal_admin')
  })

  it('cancels active dispatch and clears currentDispatchId', async () => {
    mockDb = createMockDb({
      report: {
        reportId: 'rep-dispatch',
        status: 'resolved',
        municipalityId: 'daet',
        currentDispatchId: 'disp-1',
      },
      dispatch: { dispatchId: 'disp-1', status: 'pending' },
    })

    await closeReportCore(mockDb, {
      reportId: 'rep-dispatch',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    const dispatchUpdate = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'dispatches/disp-1',
    )
    expect(dispatchUpdate).toBeDefined()
    expect((dispatchUpdate![1] as Record<string, unknown>).status).toBe('cancelled')
    expect((dispatchUpdate![1] as Record<string, unknown>).cancelReason).toBe('report_closed')
    expect((dispatchUpdate![1] as Record<string, unknown>).cancelledBy).toBe('admin-1')

    const reportUpdate = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'reports/rep-dispatch',
    )
    expect((reportUpdate![1] as Record<string, unknown>).currentDispatchId).toBeNull()
  })

  it('does not cancel dispatch already in terminal state', async () => {
    mockDb = createMockDb({
      report: {
        reportId: 'rep-term',
        status: 'resolved',
        municipalityId: 'daet',
        currentDispatchId: 'disp-2',
      },
      dispatch: { dispatchId: 'disp-2', status: 'resolved' },
    })

    await closeReportCore(mockDb, {
      reportId: 'rep-term',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    const dispatchUpdate = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'dispatches/disp-2',
    )
    expect(dispatchUpdate).toBeUndefined()

    const reportUpdate = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'reports/rep-term',
    )
    expect(reportUpdate).toBeDefined()
    expect((reportUpdate![1] as Record<string, unknown>).status).toBe('closed')
  })

  it('syncs report_ops status to closed when doc exists', async () => {
    mockDb = createMockDb({
      report: {
        reportId: 'rep-ops',
        status: 'resolved',
        municipalityId: 'daet',
      },
      reportOps: { reportId: 'rep-ops', status: 'resolved', updatedAt: 1713340000000 },
    })

    await closeReportCore(mockDb, {
      reportId: 'rep-ops',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'admin-1',
        claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    const opsUpdate = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'report_ops/rep-ops',
    )
    expect(opsUpdate).toBeDefined()
    expect((opsUpdate![1] as Record<string, unknown>).status).toBe('closed')
    expect((opsUpdate![1] as Record<string, unknown>).updatedAt).toBe(1713350400000)
  })

  it('allows provincial_superadmin to close without municipalityId', async () => {
    mockDb = createMockDb({
      reportId: 'rep-super',
      status: 'resolved',
      municipalityId: 'daet',
    })

    const result = await closeReportCore(mockDb, {
      reportId: 'rep-super',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      actor: {
        uid: 'super-1',
        claims: { role: 'provincial_superadmin', active: true },
      },
      now: {
        toMillis: () => 1713350400000,
      } as unknown as import('firebase-admin/firestore').Timestamp,
    })

    expect(result.status).toBe('closed')
    const reportUpdate = mockDb._txUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as { path?: string }).path === 'reports/rep-super',
    )
    expect(reportUpdate).toBeDefined()
  })
})
