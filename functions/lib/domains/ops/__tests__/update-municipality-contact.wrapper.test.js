import { describe, it, expect, vi } from 'vitest';
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
import { updateMunicipalityContact } from '../update-municipality-contact.js';
const handler = updateMunicipalityContact;
function request(auth, data) {
    return { auth, data };
}
const ADMIN_TOKEN = { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' };
const VALID_DATA = {
    municipalityId: 'daet',
    mdrrmoLabel: 'Daet MDRRMO',
    mdrrmoHotline: '(054) 721-1216',
};
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
    });
    it('rejects an unknown municipality id', async () => {
        await expect(handler(request({ uid: 'admin-1', token: ADMIN_TOKEN }, { ...VALID_DATA, municipalityId: 'manila' }))).rejects.toMatchObject({ code: 'invalid-argument' });
    });
});
//# sourceMappingURL=update-municipality-contact.wrapper.test.js.map