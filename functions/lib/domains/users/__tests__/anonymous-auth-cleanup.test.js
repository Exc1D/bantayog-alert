import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anonymousAuthCleanupCore } from '../anonymous-auth-cleanup.js';
const NOW = Date.parse('2026-05-25T00:00:00.000Z');
function user(overrides) {
    return {
        uid: overrides.uid,
        email: overrides.email,
        phoneNumber: overrides.phoneNumber,
        providerData: overrides.providerData ?? [],
        customClaims: overrides.customClaims,
        metadata: {
            creationTime: overrides.createdAt ?? '2026-04-01T00:00:00.000Z',
            lastSignInTime: overrides.lastSignInAt,
        },
    };
}
describe('anonymousAuthCleanupCore', () => {
    const auth = {
        listUsers: vi.fn(),
        deleteUsers: vi.fn(),
    };
    beforeEach(() => {
        auth.listUsers.mockReset();
        auth.deleteUsers.mockReset();
    });
    it('deletes only stale providerless anonymous users', async () => {
        auth.listUsers.mockResolvedValue({
            users: [
                user({ uid: 'anon-old', lastSignInAt: '2026-04-20T00:00:00.000Z' }),
                user({ uid: 'anon-recent', lastSignInAt: '2026-05-10T00:00:00.000Z' }),
                user({ uid: 'registered-email', email: 'citizen@example.test' }),
                user({ uid: 'registered-phone', phoneNumber: '+639171234567' }),
                user({ uid: 'google-user', providerData: [{ providerId: 'google.com' }] }),
                user({ uid: 'staff-claims', customClaims: { role: 'municipal_admin' } }),
            ],
        });
        auth.deleteUsers.mockResolvedValue({ successCount: 1, failureCount: 0, errors: [] });
        const result = await anonymousAuthCleanupCore({
            auth,
            now: () => NOW,
            sleep: () => Promise.resolve(),
        });
        expect(auth.deleteUsers).toHaveBeenCalledWith(['anon-old']);
        expect(result).toMatchObject({
            scanned: 6,
            eligible: 1,
            deleted: 1,
            failed: 0,
            pagesScanned: 1,
            hasMore: false,
        });
    });
    it('uses creation time when last sign-in time is absent', async () => {
        auth.listUsers.mockResolvedValue({
            users: [user({ uid: 'anon-created-old', createdAt: '2026-04-01T00:00:00.000Z' })],
        });
        auth.deleteUsers.mockResolvedValue({ successCount: 1, failureCount: 0, errors: [] });
        await anonymousAuthCleanupCore({ auth, now: () => NOW, sleep: () => Promise.resolve() });
        expect(auth.deleteUsers).toHaveBeenCalledWith(['anon-created-old']);
    });
    it('counts batch delete failures without stopping the sweep', async () => {
        auth.listUsers.mockResolvedValue({
            users: [
                user({ uid: 'anon-1', lastSignInAt: '2026-04-01T00:00:00.000Z' }),
                user({ uid: 'anon-2', lastSignInAt: '2026-04-01T00:00:00.000Z' }),
            ],
        });
        auth.deleteUsers.mockResolvedValue({
            successCount: 1,
            failureCount: 1,
            errors: [{ index: 1, error: new Error('quota') }],
        });
        const result = await anonymousAuthCleanupCore({
            auth,
            now: () => NOW,
            sleep: () => Promise.resolve(),
        });
        expect(result.deleted).toBe(1);
        expect(result.failed).toBe(1);
    });
    it('marks hasMore when the per-run page cap is reached', async () => {
        auth.listUsers
            .mockResolvedValueOnce({
            users: [],
            pageToken: 'next-page',
        })
            .mockResolvedValueOnce({
            users: [],
            pageToken: 'still-more',
        });
        const result = await anonymousAuthCleanupCore({
            auth,
            maxPages: 2,
            now: () => NOW,
            sleep: () => Promise.resolve(),
        });
        expect(result.pagesScanned).toBe(2);
        expect(result.hasMore).toBe(true);
    });
});
//# sourceMappingURL=anonymous-auth-cleanup.test.js.map