import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockAdminDb = vi.hoisted(() => {
    const update = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({ exists: true, data: () => ({}) });
    const doc = vi.fn(() => ({ get, update, set }));
    const collection = vi.fn(() => ({ doc }));
    const runTransaction = vi.fn(() => Promise.resolve(undefined));
    return { collection, runTransaction, _update: update, _set: set, _doc: doc };
});
vi.mock('../../../admin-init.js', () => ({ adminDb: mockAdminDb }));
vi.mock('../../shared/rate-limit.js', () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => mockAdminDb),
    Timestamp: { now: vi.fn(() => ({ seconds: 1, nanoseconds: 0 })) },
}));
vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_opts, fn) => fn),
    HttpsError: vi.fn(function HttpsError(code, message, details) {
        const error = new Error(message);
        error.code = code;
        if (details)
            error.details = details;
        return error;
    }),
}));
import { updateMunicipalityContact } from '../update-municipality-contact.js';
const handler = updateMunicipalityContact;
function request(auth, data) {
    return { auth, data };
}
const ADMIN_TOKEN = { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' };
const SUPERADMIN_TOKEN = { role: 'provincial_superadmin', accountStatus: 'active' };
const VALID_DATA = {
    municipalityId: 'daet',
    mdrrmoLabel: 'Daet MDRRMO',
    mdrrmoHotline: '(054) 721-1216',
};
beforeEach(() => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mockAdminDb._update.mockClear();
    mockAdminDb._set.mockClear();
});
describe('updateMunicipalityContact handler auth/validation', () => {
    it('rejects unauthenticated callers', async () => {
        await expect(handler(request(null, VALID_DATA))).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });
    it('rejects citizen callers', async () => {
        await expect(handler(request({ uid: 'c1', token: { role: 'citizen', accountStatus: 'active' } }, VALID_DATA))).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('rejects a malformed hotline before any write', async () => {
        await expect(handler(request({ uid: 'admin-1', token: ADMIN_TOKEN }, { ...VALID_DATA, mdrrmoHotline: 'call us maybe' }))).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(mockAdminDb._update).not.toHaveBeenCalled();
    });
    it('rejects an unknown municipality id', async () => {
        await expect(handler(request({ uid: 'admin-1', token: ADMIN_TOKEN }, { ...VALID_DATA, municipalityId: 'manila' }))).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(mockAdminDb._update).not.toHaveBeenCalled();
    });
});
describe('updateMunicipalityContact handler rate limiting', () => {
    it('throws resource-exhausted with retryAfterSeconds when rate limited', async () => {
        mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });
        await expect(handler(request({ uid: 'admin-1', token: ADMIN_TOKEN }, VALID_DATA))).rejects.toMatchObject({
            code: 'resource-exhausted',
            details: { retryAfterSeconds: 60 },
        });
        expect(mockCheckRateLimit).toHaveBeenCalledWith(mockAdminDb, expect.objectContaining({ key: 'updateMunicipalityContact:admin-1', limit: 10 }));
    });
    it('updates contact when rate limit allows', async () => {
        await expect(handler(request({ uid: 'super-1', token: SUPERADMIN_TOKEN }, VALID_DATA))).resolves.toEqual({
            municipalityId: 'daet',
            mdrrmoLabel: 'Daet MDRRMO',
            mdrrmoHotline: '(054) 721-1216',
            updatedAt: expect.any(Number),
        });
        expect(mockAdminDb._update).toHaveBeenCalledWith(expect.objectContaining({
            mdrrmoLabel: 'Daet MDRRMO',
            mdrrmoHotline: '(054) 721-1216',
            contactUpdatedAt: expect.any(Number),
            contactUpdatedBy: 'super-1',
        }));
    });
});
//# sourceMappingURL=update-municipality-contact.wrapper.test.js.map