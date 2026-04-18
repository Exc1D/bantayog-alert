import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'
import { withIdempotency, IdempotencyMismatchError } from '../../idempotency/guard.js'

function makeMockFirestore() {
  const store = new Map<string, Record<string, unknown>>()
  const ref = (path: string) => ({
    path,
    get: vi.fn(() => {
      const data = store.get(path)
      return {
        exists: data != null,
        data: () => data,
      }
    }),
    set: vi.fn((value: Record<string, unknown>) => {
      store.set(path, value)
    }),
    update: vi.fn((value: Record<string, unknown>) => {
      const existing = store.get(path) ?? {}
      store.set(path, { ...existing, ...value })
    }),
  })
  return {
    runTransaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) => {
      const tx = {
        get: async (r: { get: () => Promise<unknown> }) => r.get(),
        set: async (
          r: { set: (v: Record<string, unknown>) => Promise<void> },
          value: Record<string, unknown>,
        ) => r.set(value),
        update: async (
          r: { update: (v: Record<string, unknown>) => Promise<void> },
          value: Record<string, unknown>,
        ) => r.update(value),
      }
      return fn(tx)
    }),
    collection: vi.fn((name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) })),
    doc: vi.fn((path: string) => ref(path)),
    _store: store,
  } as unknown as Firestore & { _store: Map<string, Record<string, unknown>> }
}

describe('withIdempotency', () => {
  let db: ReturnType<typeof makeMockFirestore>
  beforeEach(() => {
    db = makeMockFirestore()
  })

  it('runs the operation and writes the key on first call', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const op = vi.fn(async () => ({ resultId: 'x1' }))
    const { result, fromCache } = await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 1000,
      },
      op,
    )
    expect(result).toEqual({ resultId: 'x1' })
    expect(fromCache).toBe(false)
    expect(op).toHaveBeenCalledTimes(1)
    expect(db._store.has('idempotency_keys/cb:verifyReport:u1')).toBe(true)
  })

  it('returns cached result on replay with matching payload hash', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const op = vi.fn(async () => ({ resultId: 'x1' }))
    await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 1000,
      },
      op,
    )
    const { result: cachedResult, fromCache } = await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 2000,
      },
      op,
    )
    expect(op).toHaveBeenCalledTimes(1)
    expect(cachedResult).toEqual({ resultId: 'x1' })
    expect(fromCache).toBe(true)
  })

  it('throws IdempotencyMismatchError on same key with different payload', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const op = vi.fn(async () => ({ resultId: 'x1' }))
    await withIdempotency(
      db,
      {
        key: 'cb:verifyReport:u1',
        payload: { reportId: 'r1' },
        now: () => 1000,
      },
      op,
    )
    await expect(
      withIdempotency(
        db,
        {
          key: 'cb:verifyReport:u1',
          payload: { reportId: 'r2' },
          now: () => 2000,
        },
        op,
      ),
    ).rejects.toBeInstanceOf(IdempotencyMismatchError)
    expect(op).toHaveBeenCalledTimes(1)
  })
})
