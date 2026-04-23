import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withIdempotency, IdempotencyMismatchError } from '../../idempotency/guard.js';
function makeMockFirestore() {
    const store = new Map();
    const ref = (path) => ({
        path,
        get: vi.fn(() => {
            const data = store.get(path);
            return {
                exists: data != null,
                data: () => data,
            };
        }),
        set: vi.fn((value) => {
            store.set(path, value);
        }),
        update: vi.fn((value) => {
            const existing = store.get(path) ?? {};
            store.set(path, { ...existing, ...value });
        }),
    });
    return {
        runTransaction: vi.fn(async (fn) => {
            const tx = {
                get: async (r) => r.get(),
                set: async (r, value) => r.set(value),
                update: async (r, value) => r.update(value),
            };
            return fn(tx);
        }),
        collection: vi.fn((name) => ({ doc: (id) => ref(`${name}/${id}`) })),
        doc: vi.fn((path) => ref(path)),
        _store: store,
    };
}
describe('withIdempotency', () => {
    let db;
    beforeEach(() => {
        db = makeMockFirestore();
    });
    it('runs the operation and writes the key on first call', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        const op = vi.fn(async () => ({ resultId: 'x1' }));
        const { result, fromCache } = await withIdempotency(db, {
            key: 'cb:verifyReport:u1',
            payload: { reportId: 'r1' },
            now: () => 1000,
        }, op);
        expect(result).toEqual({ resultId: 'x1' });
        expect(fromCache).toBe(false);
        expect(op).toHaveBeenCalledTimes(1);
        expect(db._store.has('idempotency_keys/cb:verifyReport:u1')).toBe(true);
    });
    it('returns cached result on replay with matching payload hash', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        const op = vi.fn(async () => ({ resultId: 'x1' }));
        await withIdempotency(db, {
            key: 'cb:verifyReport:u1',
            payload: { reportId: 'r1' },
            now: () => 1000,
        }, op);
        const { result: cachedResult, fromCache } = await withIdempotency(db, {
            key: 'cb:verifyReport:u1',
            payload: { reportId: 'r1' },
            now: () => 2000,
        }, op);
        expect(op).toHaveBeenCalledTimes(1);
        expect(cachedResult).toEqual({ resultId: 'x1' });
        expect(fromCache).toBe(true);
    });
    it('throws IdempotencyMismatchError on same key with different payload', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        const op = vi.fn(async () => ({ resultId: 'x1' }));
        await withIdempotency(db, {
            key: 'cb:verifyReport:u1',
            payload: { reportId: 'r1' },
            now: () => 1000,
        }, op);
        await expect(withIdempotency(db, {
            key: 'cb:verifyReport:u1',
            payload: { reportId: 'r2' },
            now: () => 2000,
        }, op)).rejects.toBeInstanceOf(IdempotencyMismatchError);
        expect(op).toHaveBeenCalledTimes(1);
    });
});
//# sourceMappingURL=guard.test.js.map