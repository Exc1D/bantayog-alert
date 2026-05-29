import { describe, expect, it, vi } from 'vitest';
vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_opts, fn) => fn),
    HttpsError: class HttpsError extends Error {
        code;
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    },
}));
import { setCitizenContentVisibilityCore } from '../citizen-content-visibility.js';
function createMockDb(seed) {
    const update = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockResolvedValue(undefined);
    const doc = vi.fn((id) => ({
        id: id ?? 'incident-1',
        get: vi.fn().mockResolvedValue({
            exists: id ? seed[id] !== undefined : false,
            data: () => (id ? seed[id] : undefined),
        }),
        update,
        set,
    }));
    const collection = vi.fn(() => ({ doc }));
    return { collection, _update: update, _set: set };
}
describe('setCitizenContentVisibilityCore', () => {
    it('hides a citizen feed post in the admin municipality', async () => {
        const db = createMockDb({
            'sit-1': { municipalityId: 'daet', visibility: 'public' },
        });
        await setCitizenContentVisibilityCore(db, {
            surface: 'feed',
            contentId: 'sit-1',
            visibility: 'internal',
            reason: 'sensitive_content',
            actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
            now: 1234,
        });
        expect(db._update).toHaveBeenCalledWith(expect.objectContaining({
            visibility: 'internal',
            moderatedBy: 'admin-1',
            moderationReason: 'sensitive_content',
        }));
        expect(db._set).toHaveBeenCalledWith(expect.objectContaining({
            contentSurface: 'feed',
            contentId: 'sit-1',
            action: 'hide',
        }));
    });
    it('rejects municipal admins hiding another municipality feed post', async () => {
        const db = createMockDb({
            'sit-1': { municipalityId: 'labo', visibility: 'public' },
        });
        await expect(setCitizenContentVisibilityCore(db, {
            surface: 'feed',
            contentId: 'sit-1',
            visibility: 'internal',
            reason: 'sensitive_content',
            actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
            now: 1234,
        })).rejects.toMatchObject({ code: 'permission-denied' });
    });
});
//# sourceMappingURL=citizen-content-visibility.test.js.map