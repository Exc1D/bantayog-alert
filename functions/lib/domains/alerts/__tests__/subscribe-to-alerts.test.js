import { describe, it, expect, vi, beforeEach } from 'vitest';
import {} from 'firebase-admin/firestore';
const { mockCheckRateLimit, mockSubscribeToTopic } = vi.hoisted(() => ({
    mockCheckRateLimit: vi.fn(),
    mockSubscribeToTopic: vi.fn().mockResolvedValue({ successCount: 1, failureCount: 0, errors: [] }),
}));
vi.mock('firebase-admin', () => ({
    messaging: vi.fn(() => ({
        subscribeToTopic: mockSubscribeToTopic,
    })),
}));
vi.mock('../../../admin-init.js', () => ({
    adminDb: {},
}));
vi.mock('../../../idempotency/guard.js', () => ({
    withIdempotency: vi.fn(async (_db, _opts, fn) => {
        return { result: await fn() };
    }),
}));
vi.mock('../../shared/rate-limit.js', () => ({
    checkRateLimit: mockCheckRateLimit,
}));
import { subscribeToAlertsCore } from '../subscribe-to-alerts.js';
import { Timestamp } from 'firebase-admin/firestore';
function createMockDb(userDoc) {
    const collectionFn = vi.fn((collectionPath) => {
        return {
            doc: vi.fn(() => {
                const data = collectionPath === 'responders'
                    ? { fcmTokens: userDoc?.fcmTokens ?? [] }
                    : { fcmToken: userDoc?.fcmToken ?? null };
                const exists = collectionPath === 'responders'
                    ? (userDoc?.fcmTokens ?? []).length > 0
                    : userDoc?.fcmToken !== undefined;
                return {
                    get: vi.fn().mockResolvedValue({ exists, data: () => data }),
                };
            }),
        };
    });
    return {
        collection: collectionFn,
        _collectionFn: collectionFn,
    };
}
describe('subscribeToAlertsCore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 19,
            retryAfterSeconds: 0,
        });
    });
    it('allows token matching users/{uid}.fcmToken', async () => {
        const db = createMockDb({ fcmToken: 'valid-token' });
        const result = await subscribeToAlertsCore(db, {
            token: 'valid-token',
            actor: { uid: 'user-123' },
            now: Timestamp.now(),
        });
        expect(result).toEqual({ success: true });
    });
    it('allows token in responders/{uid}.fcmTokens', async () => {
        const db = createMockDb({ fcmTokens: ['valid-token'] });
        const result = await subscribeToAlertsCore(db, {
            token: 'valid-token',
            actor: { uid: 'user-123' },
            now: Timestamp.now(),
        });
        expect(result).toEqual({ success: true });
    });
    it('rejects token not belonging to caller', async () => {
        const db = createMockDb({ fcmToken: 'other-token' });
        await expect(subscribeToAlertsCore(db, {
            token: 'stolen-token',
            actor: { uid: 'user-123' },
            now: Timestamp.now(),
        })).rejects.toThrow('does not belong');
    });
    it('rejects when the caller exceeds the subscription rate limit', async () => {
        mockCheckRateLimit.mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 42,
        });
        const db = createMockDb({ fcmToken: 'valid-token' });
        await expect(subscribeToAlertsCore(db, {
            token: 'valid-token',
            actor: { uid: 'user-123' },
            now: Timestamp.now(),
        })).rejects.toMatchObject({
            code: 'resource-exhausted',
            details: { retryAfterSeconds: 42 },
        });
        expect(mockSubscribeToTopic).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=subscribe-to-alerts.test.js.map