import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const mockStreamAuditEvent = vi.hoisted(() => vi.fn());
const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue('test-msg-id'));
vi.mock('../../ops/audit-stream.js', () => ({
    streamAuditEvent: mockStreamAuditEvent,
}));
vi.mock('firebase-admin', () => ({
    messaging: vi.fn(() => ({
        send: mockSend,
    })),
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
import { declareAlertCore } from '../callables.js';
import { ZodError } from 'zod';
function createMockDb() {
    const setFn = vi.fn().mockResolvedValue(undefined);
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const docFn = vi.fn(() => ({ set: setFn, update: updateFn }));
    const queryGetFn = vi.fn().mockResolvedValue({ docs: [] });
    const whereFn = vi.fn(() => ({ where: whereFn, get: queryGetFn }));
    const collectionFn = vi.fn(() => ({
        doc: docFn,
        where: whereFn,
    }));
    const runTransaction = vi.fn((callback) => callback({
        get: vi.fn().mockResolvedValue({ docs: [] }),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
    }));
    return {
        collection: collectionFn,
        runTransaction,
        _setFn: setFn,
        _collectionFn: collectionFn,
    };
}
const validInput = {
    hazardType: 'typhoon',
    affectedMunicipalityIds: ['daet', 'san-vicente'],
    message: 'Signal no. 3 raised',
};
describe('declareAlertCore', () => {
    let mockDb;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalFunctionsEmulator = process.env.FUNCTIONS_EMULATOR;
    beforeEach(() => {
        mockDb = createMockDb();
        mockStreamAuditEvent.mockClear();
        mockSend.mockClear();
        process.env.NODE_ENV = 'development';
        delete process.env.FUNCTIONS_EMULATOR;
    });
    afterEach(() => {
        vi.restoreAllMocks();
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        }
        else {
            process.env.NODE_ENV = originalNodeEnv;
        }
        if (originalFunctionsEmulator === undefined) {
            delete process.env.FUNCTIONS_EMULATOR;
        }
        else {
            process.env.FUNCTIONS_EMULATOR = originalFunctionsEmulator;
        }
    });
    it('writes alert doc with correct fields', async () => {
        const result = await declareAlertCore(mockDb, validInput, { uid: 'admin-1' });
        expect(result.alertId).toBeDefined();
        expect(typeof result.alertId).toBe('string');
        expect(mockDb._collectionFn).toHaveBeenCalledWith('alerts');
        expect(mockDb._setFn).toHaveBeenCalledTimes(1);
        const calls = mockDb._setFn.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const setArg = calls[0][0];
        expect(setArg.alertType).toBe('alert');
        expect(setArg.hazardType).toBe('typhoon');
        expect(setArg.affectedMunicipalityIds).toEqual(['daet', 'san-vicente']);
        expect(setArg.message).toBe('Signal no. 3 raised');
        expect(setArg.declaredBy).toBe('admin-1');
        expect(setArg.declaredAt).toBeDefined();
        expect(setArg.publishedAt).toBeDefined();
        expect(setArg.publishedAt).toBe(setArg.declaredAt);
        expect(setArg.schemaVersion).toBe(1);
    });
    it('stores expanded alert metadata offered by the admin modal', async () => {
        const input = {
            ...validInput,
            hazardType: 'road_closure',
            effectiveFrom: 1_000,
            effectiveUntil: 2_000,
            expectedResolutionAt: 3_000,
            affectedSectors: ['transportation'],
            affectedBarangayIds: ['alawihao'],
            roadName: 'Vinzons Avenue',
        };
        await declareAlertCore(mockDb, input, { uid: 'admin-1' });
        expect(mockDb._setFn).toHaveBeenCalledWith(expect.objectContaining(input));
    });
    it('throws ZodError for empty hazardType', async () => {
        await expect(declareAlertCore(mockDb, { ...validInput, hazardType: '' }, { uid: 'admin-1' })).rejects.toThrow(ZodError);
    });
    it('throws ZodError for empty municipalityIds', async () => {
        await expect(declareAlertCore(mockDb, { ...validInput, affectedMunicipalityIds: [] }, { uid: 'admin-1' })).rejects.toThrow(ZodError);
    });
    it('streams audit event', async () => {
        const before = Date.now();
        const result = await declareAlertCore(mockDb, validInput, { uid: 'admin-1' });
        const after = Date.now();
        expect(mockStreamAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'alert_declared',
            actorUid: 'admin-1',
            targetDocumentId: result.alertId,
            metadata: expect.objectContaining({ hazardType: 'typhoon' }),
        }));
        const calls = mockStreamAuditEvent.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const callArg = calls[0][0];
        expect(callArg.occurredAt).toBeGreaterThanOrEqual(before);
        expect(callArg.occurredAt).toBeLessThanOrEqual(after);
    });
    it('stores reportId when provided', async () => {
        const inputWithReportId = {
            ...validInput,
            reportId: '550e8400-e29b-41d4-a716-446655440000',
        };
        const result = await declareAlertCore(mockDb, inputWithReportId, { uid: 'admin-1' });
        expect(result.alertId).toBeDefined();
        const calls = mockDb._setFn.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const setArg = calls[0][0];
        expect(setArg.reportId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
    it('allows municipal admins to declare alerts for their municipality', async () => {
        const result = await declareAlertCore(mockDb, { ...validInput, affectedMunicipalityIds: ['daet'] }, { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } });
        expect(result.alertId).toBeDefined();
        expect(mockDb._setFn).toHaveBeenCalledTimes(1);
        expect(mockDb._setFn).toHaveBeenCalledWith(expect.objectContaining({ municipalityId: 'daet' }));
    });
    it('deduplicates repeated municipalities before projecting municipalityId', async () => {
        await declareAlertCore(mockDb, { ...validInput, affectedMunicipalityIds: ['daet', 'daet'] }, { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } });
        const setArg = mockDb._setFn.mock.calls[0][0];
        expect(setArg.affectedMunicipalityIds).toEqual(['daet']);
        expect(setArg.municipalityScope).toEqual({ daet: true });
        expect(setArg.municipalityId).toBe('daet');
    });
    it('omits scalar municipalityId for multi-municipality alerts', async () => {
        await declareAlertCore(mockDb, validInput, { uid: 'admin-1' });
        const setArg = mockDb._setFn.mock.calls[0][0];
        expect('municipalityId' in setArg).toBe(false);
        expect(setArg.municipalityScope).toEqual({ daet: true, 'san-vicente': true });
    });
    it('rejects municipal admins declaring alerts outside their municipality', async () => {
        await expect(declareAlertCore(mockDb, validInput, {
            uid: 'admin-1',
            claims: { role: 'municipal_admin', municipalityId: 'daet' },
        })).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('sends FCM push to alerts topic', async () => {
        const result = await declareAlertCore(mockDb, validInput, { uid: 'admin-1' });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            topic: 'alerts',
            notification: expect.objectContaining({
                title: 'Alert Issued',
                body: validInput.message,
            }),
            data: expect.objectContaining({
                alertId: result.alertId,
                hazardType: validInput.hazardType,
            }),
        }));
    });
    it('skips FCM push in the functions emulator', async () => {
        process.env.FUNCTIONS_EMULATOR = 'true';
        const result = await declareAlertCore(mockDb, validInput, { uid: 'admin-1' });
        expect(result.alertId).toBeDefined();
        expect(mockSend).not.toHaveBeenCalled();
    });
    it('does not fail alert creation if FCM push fails', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
            return;
        });
        mockSend.mockRejectedValueOnce(new Error('FCM down'));
        const result = await declareAlertCore(mockDb, validInput, { uid: 'admin-1' });
        expect(result.alertId).toBeDefined();
        expect(mockDb._setFn).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('FCM push failed:', expect.any(Error));
    });
});
//# sourceMappingURL=callables.test.js.map