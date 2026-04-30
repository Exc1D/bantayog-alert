import { describe, it, expect, vi } from 'vitest';
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators';
const mockReplay = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../services/hazard-signal-projector.js', () => ({
    replayHazardSignalProjection: mockReplay,
}));
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
function createMockDb() {
    const setFn = vi.fn().mockResolvedValue(undefined);
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const getFn = vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'active' }) });
    const docFn = vi.fn(() => ({ set: setFn, update: updateFn, get: getFn }));
    const collectionFn = vi.fn(() => ({ doc: docFn }));
    return {
        collection: collectionFn,
        _setFn: setFn,
        _updateFn: updateFn,
        _getFn: getFn,
        _docFn: docFn,
    };
}
const superadminActor = { uid: 'super-1', role: 'provincial_superadmin' };
const muniAdminActor = { uid: 'muni-1', role: 'municipal_admin' };
const futureTimestamp = () => Date.now() + 60_000;
import { declareHazardSignalCore, clearHazardSignalCore, } from '../../callables/declare-hazard-signal.js';
import { beforeEach } from 'vitest';
beforeEach(() => {
    mockReplay.mockClear();
});
describe('declareHazardSignalCore', () => {
    it('rejects non-superadmin callers', async () => {
        const db = createMockDb();
        await expect(declareHazardSignalCore(db, {
            signalLevel: 3,
            scopeType: 'province',
            affectedMunicipalityIds: CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id),
            validUntil: futureTimestamp(),
            reason: 'test',
        }, muniAdminActor)).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('normalizes province scope to all municipalities', async () => {
        const db = createMockDb();
        const result = await declareHazardSignalCore(db, {
            signalLevel: 4,
            scopeType: 'province',
            affectedMunicipalityIds: ['daet'],
            validUntil: futureTimestamp(),
            reason: 'test',
        }, superadminActor);
        expect(result.affectedMunicipalityIds).toEqual(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id));
    });
    it('writes a valid hazard signal document', async () => {
        const db = createMockDb();
        await declareHazardSignalCore(db, {
            signalLevel: 3,
            scopeType: 'municipalities',
            affectedMunicipalityIds: ['daet'],
            validUntil: futureTimestamp(),
            reason: 'PAGASA radio confirmation',
        }, superadminActor);
        expect(db._setFn).toHaveBeenCalledOnce();
        const firstCall = db._setFn.mock.calls[0];
        expect(firstCall).toBeDefined();
        const written = firstCall[0];
        expect(written).toMatchObject({
            hazardType: 'tropical_cyclone',
            source: 'manual',
            status: 'active',
            schemaVersion: 1,
        });
    });
    it('returns signalId and affectedMunicipalityIds', async () => {
        const db = createMockDb();
        const result = await declareHazardSignalCore(db, {
            signalLevel: 2,
            scopeType: 'municipalities',
            affectedMunicipalityIds: ['daet', 'san-vicente'],
            validUntil: futureTimestamp(),
            reason: 'test',
        }, superadminActor);
        expect(typeof result.signalId).toBe('string');
        expect(result.affectedMunicipalityIds).toEqual(['daet', 'san-vicente']);
    });
    it('rejects validUntil that is already expired', async () => {
        const db = createMockDb();
        await expect(declareHazardSignalCore(db, {
            signalLevel: 3,
            scopeType: 'province',
            affectedMunicipalityIds: CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id),
            validUntil: Date.now() - 1000,
            reason: 'test',
        }, superadminActor)).rejects.toMatchObject({ code: 'invalid-argument' });
    });
});
describe('clearHazardSignalCore', () => {
    it('rejects non-superadmin callers', async () => {
        const db = createMockDb();
        await expect(clearHazardSignalCore(db, { signalId: 'sig-1', reason: 'all clear' }, muniAdminActor)).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('marks the signal as cleared', async () => {
        const updateFn = vi.fn().mockResolvedValue(undefined);
        const getFn = vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'active' }) });
        const docFn = vi.fn(() => ({ get: getFn, update: updateFn }));
        const db = { collection: vi.fn(() => ({ doc: docFn })) };
        await clearHazardSignalCore(db, { signalId: 'sig-1', reason: 'storm passed' }, superadminActor);
        expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'cleared' }));
    });
    it('throws not-found when clearing a non-existent signal', async () => {
        const getFn = vi.fn().mockResolvedValue({ exists: false });
        const docFn = vi.fn(() => ({ get: getFn, update: vi.fn() }));
        const db = { collection: vi.fn(() => ({ doc: docFn })) };
        await expect(clearHazardSignalCore(db, { signalId: 'missing', reason: 'test' }, superadminActor)).rejects.toMatchObject({ code: 'not-found' });
    });
    it('throws failed-precondition when clearing a non-active signal', async () => {
        const getFn = vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'expired' }) });
        const docFn = vi.fn(() => ({ get: getFn, update: vi.fn() }));
        const db = { collection: vi.fn(() => ({ doc: docFn })) };
        await expect(clearHazardSignalCore(db, { signalId: 'sig-1', reason: 'test' }, superadminActor)).rejects.toMatchObject({ code: 'failed-precondition' });
    });
    it('returns signalId and cleared status', async () => {
        const db = createMockDb();
        const result = await clearHazardSignalCore(db, { signalId: 'sig-42', reason: 'all clear' }, superadminActor);
        expect(result).toEqual({ signalId: 'sig-42', status: 'cleared', clearedReason: 'all clear' });
    });
});
//# sourceMappingURL=declare-hazard-signal.test.js.map