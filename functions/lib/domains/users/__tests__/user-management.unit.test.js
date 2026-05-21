import { describe, it, expect, vi } from 'vitest';
// Mock firebase-admin before importing callable modules
vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({})),
}));
vi.mock('firebase-admin/app', () => ({
    getApps: vi.fn(() => []),
    initializeApp: vi.fn(() => ({
        getOrInitService: vi.fn(() => ({})),
    })),
}));
vi.mock('firebase-admin/auth', () => ({
    getAuth: vi.fn(() => ({
        updateUser: vi.fn(() => Promise.resolve({})),
    })),
}));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({})),
    Firestore: vi.fn(),
    Timestamp: {
        now: vi.fn(() => ({ toMillis: vi.fn(() => Date.now()) })),
        fromMillis: vi.fn((ms) => ({ toMillis: vi.fn(() => ms) })),
    },
}));
vi.mock('../../../idempotency/guard.js', () => ({
    withIdempotency: vi.fn(async (_db, _opts, op) => ({ result: await op(), fromCache: false })),
}));
vi.mock('../../shared/rate-limit.js', () => ({
    checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, remaining: 59, retryAfterSeconds: 0 })),
}));
import { Timestamp } from 'firebase-admin/firestore';
import { suspendUserSchema, revokeUserSchema, resetUserTotpSchema, suspendUserCore, revokeUserCore, resetUserTotpCore, } from '../user-management.js';
function mockDb(userDoc) {
    const txUpdates = [];
    const txSets = [];
    const tx = {
        get: vi.fn((ref) => Promise.resolve({
            exists: userDoc !== undefined,
            data: () => userDoc,
            ref,
        })),
        update: vi.fn((ref, data) => {
            txUpdates.push({ ref: ref.path, ...data });
        }),
        set: vi.fn((ref, data) => {
            if (!ref.path.startsWith('idempotency_keys/') && !ref.path.startsWith('rate_limits/')) {
                txSets.push({ ref: ref.path, data });
            }
        }),
    };
    const db = {
        collection: vi.fn((name) => ({
            doc: vi.fn((id) => ({ path: `${name}/${id ?? 'auto-id'}` })),
        })),
        runTransaction: vi.fn(async (fn) => fn(tx)),
    };
    return { db, tx, txUpdates, txSets };
}
function mockAuth() {
    return {
        updateUser: vi.fn(() => Promise.resolve({})),
    };
}
describe('user-management schemas', () => {
    describe('suspendUserSchema', () => {
        it('accepts well-formed request', () => {
            const result = suspendUserSchema.parse({
                uid: 'user-abc123',
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            });
            expect(result).toEqual({
                uid: 'user-abc123',
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            });
        });
        it('rejects missing uid', () => {
            expect(() => suspendUserSchema.parse({
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            })).toThrow();
        });
        it('rejects empty uid', () => {
            expect(() => suspendUserSchema.parse({
                uid: '',
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            })).toThrow();
        });
        it('rejects invalid idempotencyKey', () => {
            expect(() => suspendUserSchema.parse({
                uid: 'user-abc123',
                idempotencyKey: 'not-a-uuid',
            })).toThrow();
        });
    });
    describe('revokeUserSchema', () => {
        it('accepts well-formed request', () => {
            const result = revokeUserSchema.parse({
                uid: 'user-abc123',
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            });
            expect(result).toEqual({
                uid: 'user-abc123',
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            });
        });
        it('rejects missing uid', () => {
            expect(() => revokeUserSchema.parse({
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            })).toThrow();
        });
    });
    describe('resetUserTotpSchema', () => {
        it('accepts well-formed request', () => {
            const result = resetUserTotpSchema.parse({
                uid: 'user-abc123',
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            });
            expect(result).toEqual({
                uid: 'user-abc123',
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            });
        });
        it('rejects missing uid', () => {
            expect(() => resetUserTotpSchema.parse({
                idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            })).toThrow();
        });
    });
});
describe('suspendUserCore', () => {
    it('updates user status to suspended, disables auth, and writes audit event', async () => {
        const auth = mockAuth();
        const { db, txUpdates, txSets } = mockDb({
            role: 'municipal_admin',
            municipalityId: 'daet',
            status: 'active',
        });
        const result = await suspendUserCore(db, auth, {
            uid: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: { uid: 'admin-1', claims: { role: 'provincial_superadmin' } },
            now: Timestamp.now(),
        });
        expect(result.uid).toBe('user-1');
        expect(result.status).toBe('suspended');
        expect(db.runTransaction).toHaveBeenCalledTimes(1);
        expect(auth.updateUser).toHaveBeenCalledWith('user-1', { disabled: true });
        expect(txUpdates).toHaveLength(1);
        expect(txUpdates[0]).toMatchObject({
            ref: 'users/user-1',
            status: 'suspended',
        });
        expect(txSets).toHaveLength(1);
        expect(txSets[0]).toMatchObject({
            ref: expect.stringMatching(/^report_events\//),
        });
    });
    it('throws if user not found', async () => {
        const auth = mockAuth();
        const { db } = mockDb(undefined);
        await expect(suspendUserCore(db, auth, {
            uid: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: { uid: 'admin-1', claims: { role: 'provincial_superadmin' } },
            now: Timestamp.now(),
        })).rejects.toThrow('not found');
    });
    it('throws FORBIDDEN when municipal_admin targets user in another municipality', async () => {
        const auth = mockAuth();
        const { db } = mockDb({
            role: 'municipal_admin',
            municipalityId: 'other-town',
            status: 'active',
        });
        await expect(suspendUserCore(db, auth, {
            uid: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
            now: Timestamp.now(),
        })).rejects.toThrow('cannot manage users outside your municipality');
    });
    it('throws FORBIDDEN when municipal_admin targets provincial_superadmin', async () => {
        const auth = mockAuth();
        const { db } = mockDb({
            role: 'provincial_superadmin',
            municipalityId: 'daet',
            status: 'active',
        });
        await expect(suspendUserCore(db, auth, {
            uid: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
            now: Timestamp.now(),
        })).rejects.toThrow('insufficient privileges');
    });
});
describe('revokeUserCore', () => {
    it('updates user status to revoked, disables auth, and writes audit event', async () => {
        const auth = mockAuth();
        const { db, txUpdates, txSets } = mockDb({
            role: 'municipal_admin',
            municipalityId: 'daet',
            status: 'active',
        });
        const result = await revokeUserCore(db, auth, {
            uid: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: { uid: 'admin-1', claims: { role: 'provincial_superadmin' } },
            now: Timestamp.now(),
        });
        expect(result.uid).toBe('user-1');
        expect(result.status).toBe('revoked');
        expect(db.runTransaction).toHaveBeenCalledTimes(1);
        expect(auth.updateUser).toHaveBeenCalledWith('user-1', { disabled: true });
        expect(txUpdates).toHaveLength(1);
        expect(txUpdates[0]).toMatchObject({
            ref: 'users/user-1',
            status: 'revoked',
        });
        expect(txSets).toHaveLength(1);
    });
});
describe('resetUserTotpCore', () => {
    it('clears totp fields and auth mfa, writes audit event', async () => {
        const auth = mockAuth();
        const { db, txUpdates, txSets } = mockDb({
            role: 'municipal_admin',
            municipalityId: 'daet',
            totpSecret: 'secret123',
            totpEnrolledAt: Date.now(),
        });
        const result = await resetUserTotpCore(db, auth, {
            uid: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: { uid: 'admin-1', claims: { role: 'provincial_superadmin' } },
            now: Timestamp.now(),
        });
        expect(result.uid).toBe('user-1');
        expect(result.reset).toBe(true);
        expect(auth.updateUser).toHaveBeenCalledWith('user-1', {
            multiFactor: { enrolledFactors: [] },
        });
        expect(txUpdates).toHaveLength(1);
        expect(txUpdates[0]).toMatchObject({
            ref: 'users/user-1',
            totpSecret: null,
            totpEnrolledAt: null,
        });
        expect(txSets).toHaveLength(1);
    });
    it('no-ops when user has no TOTP enrolled', async () => {
        const auth = mockAuth();
        const { db, txUpdates, txSets } = mockDb({
            role: 'municipal_admin',
            municipalityId: 'daet',
            totpSecret: null,
            totpEnrolledAt: null,
        });
        const result = await resetUserTotpCore(db, auth, {
            uid: 'user-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: { uid: 'admin-1', claims: { role: 'provincial_superadmin' } },
            now: Timestamp.now(),
        });
        expect(result.uid).toBe('user-1');
        expect(result.reset).toBe(true);
        expect(auth.updateUser).not.toHaveBeenCalled();
        expect(txUpdates).toHaveLength(0);
        expect(txSets).toHaveLength(0);
    });
});
//# sourceMappingURL=user-management.unit.test.js.map