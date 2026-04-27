import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { initiateBreakGlassCore, deactivateBreakGlassCore } from '../../callables/break-glass.js';
const mockStreamAuditEvent = vi.hoisted(() => vi.fn());
vi.mock('../../services/audit-stream.js', () => ({
    streamAuditEvent: mockStreamAuditEvent,
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
const CODE_A = 'alpha-bravo-123';
const CODE_B = 'charlie-delta-456';
const CODE_WRONG = 'wrong-code-999';
let hashedA;
let hashedB;
beforeAll(async () => {
    hashedA = await bcrypt.hash(CODE_A, 10);
    hashedB = await bcrypt.hash(CODE_B, 10);
});
function makeDb(configData) {
    const configDoc = {
        exists: configData !== null,
        data: () => configData,
    };
    const eventSetFn = vi.fn().mockResolvedValue(undefined);
    const eventUpdateFn = vi.fn().mockResolvedValue(undefined);
    return {
        doc: vi.fn((path) => {
            if (path === 'system_config/break_glass_config') {
                return { get: vi.fn().mockResolvedValue(configDoc) };
            }
            throw new Error(`unexpected db.doc path: ${path}`);
        }),
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                set: eventSetFn,
                update: eventUpdateFn,
            })),
        })),
        eventSetFn,
        eventUpdateFn,
    };
}
function makeAuth(existingClaims) {
    const setCustomUserClaims = vi.fn().mockResolvedValue(undefined);
    const getUser = vi.fn().mockResolvedValue({
        customClaims: existingClaims ?? {
            role: 'superadmin',
            municipalityId: 'daet',
        },
    });
    return { setCustomUserClaims, getUser };
}
describe('initiateBreakGlassCore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('rejects when config doc is missing', async () => {
        const db = makeDb(null);
        const auth = makeAuth();
        await expect(initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'emergency' }, { uid: 'u1' })).rejects.toThrow('break_glass_config_missing');
        const err = await initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'emergency' }, { uid: 'u1' }).catch((e) => e);
        expect(err.code).toBe('not-found');
    });
    it('rejects when config has invalid hashedCodes', async () => {
        const db = makeDb({ hashedCodes: ['only-one'] });
        const auth = makeAuth();
        await expect(initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'emergency' }, { uid: 'u1' })).rejects.toThrow('break_glass_config_invalid');
        const err = await initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'emergency' }, { uid: 'u1' }).catch((e) => e);
        expect(err.code).toBe('failed-precondition');
    });
    it('rejects when hashedCodes is not an array', async () => {
        const db = makeDb({ hashedCodes: 'not-array' });
        const auth = makeAuth();
        await expect(initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'emergency' }, { uid: 'u1' })).rejects.toThrow('break_glass_config_invalid');
    });
    it('rejects when both codes match the same hash', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedA] });
        const auth = makeAuth();
        await expect(initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_A, reason: 'emergency' }, { uid: 'u1' })).rejects.toThrow('break_glass_codes_invalid');
        const err = await initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_A, reason: 'emergency' }, { uid: 'u1' }).catch((e) => e);
        expect(err.code).toBe('unauthenticated');
    });
    it('rejects when codes do not match any hash', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const auth = makeAuth();
        await expect(initiateBreakGlassCore(db, auth, { codeA: CODE_WRONG, codeB: CODE_WRONG, reason: 'emergency' }, { uid: 'u1' })).rejects.toThrow('break_glass_codes_invalid');
    });
    it('rejects when one code is correct but the other is wrong', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const auth = makeAuth();
        await expect(initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_WRONG, reason: 'emergency' }, { uid: 'u1' })).rejects.toThrow('break_glass_codes_invalid');
    });
    it('preserves existing custom claims when initiating break-glass session', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const auth = makeAuth();
        const result = await initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'test' }, { uid: 'u1' });
        const calls = auth.setCustomUserClaims.mock.calls;
        expect(calls.length).toBe(1);
        const claimsArg = calls[0][1];
        expect(claimsArg.role).toBe('superadmin');
        expect(claimsArg.breakGlassSession).toBe(true);
        expect(claimsArg.breakGlassSessionId).toBe(result.sessionId);
        expect(claimsArg.breakGlassExpiresAt).toBeGreaterThan(Date.now());
    });
    it('rejects when user already has an active break-glass session', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const auth = makeAuth();
        auth.getUser = vi.fn().mockResolvedValue({
            customClaims: {
                breakGlassSession: true,
                breakGlassSessionId: 'existing-session',
                breakGlassExpiresAt: Date.now() + 3600000,
            },
        });
        await expect(initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'test' }, { uid: 'u1' })).rejects.toThrow('active_break_glass_session_exists');
    });
    it('succeeds with correct codes, returns sessionId, sets claims, writes event', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const rawDb = db;
        const auth = makeAuth();
        const result = await initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'system emergency' }, { uid: 'u1' });
        expect(result.sessionId).toBeTruthy();
        expect(typeof result.sessionId).toBe('string');
        expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', expect.objectContaining({
            breakGlassSession: true,
            breakGlassSessionId: result.sessionId,
            breakGlassExpiresAt: expect.any(Number),
        }));
        expect(rawDb.eventSetFn).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: result.sessionId,
            actorUid: 'u1',
            action: 'initiated',
            reason: 'system emergency',
            schemaVersion: 1,
        }));
        expect(mockStreamAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'break_glass_initiated',
            actorUid: 'u1',
            sessionId: result.sessionId,
        }));
    });
    it('succeeds with codes in reversed order', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const auth = makeAuth();
        const result = await initiateBreakGlassCore(db, auth, { codeA: CODE_B, codeB: CODE_A, reason: 'reversed codes' }, { uid: 'u1' });
        expect(result.sessionId).toBeTruthy();
    });
    it('sets expiresAt to approximately 4 hours from now', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const auth = makeAuth();
        const before = Date.now();
        await initiateBreakGlassCore(db, auth, { codeA: CODE_A, codeB: CODE_B, reason: 'test' }, { uid: 'u1' });
        const calls = auth.setCustomUserClaims.mock.calls;
        expect(calls.length).toBe(1);
        const claimsArg = calls[0][1];
        const diff = claimsArg.breakGlassExpiresAt - before;
        expect(diff).toBeGreaterThanOrEqual(4 * 60 * 60 * 1000 - 2000);
        expect(diff).toBeLessThanOrEqual(4 * 60 * 60 * 1000 + 2000);
    });
});
describe('deactivateBreakGlassCore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('rejects when no active break glass session in claims', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const auth = makeAuth();
        await expect(deactivateBreakGlassCore(db, auth, { uid: 'u1', claims: {} })).rejects.toThrow('no_active_break_glass_session');
        const err = await deactivateBreakGlassCore(db, auth, { uid: 'u1', claims: {} }).catch((e) => e);
        expect(err.code).toBe('failed-precondition');
    });
    it('removes break glass claims and keeps remaining claims', async () => {
        const db = makeDb({ hashedCodes: [hashedA, hashedB] });
        const rawDb = db;
        const auth = makeAuth();
        await deactivateBreakGlassCore(db, auth, {
            uid: 'u1',
            claims: {
                breakGlassSession: true,
                breakGlassSessionId: 'existing-session',
                breakGlassExpiresAt: 9999,
            },
        });
        expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', {
            role: 'superadmin',
            municipalityId: 'daet',
        });
        expect(rawDb.eventUpdateFn).toHaveBeenCalledWith(expect.objectContaining({
            action: 'deactivated',
            deactivatedAt: expect.any(Number),
        }));
        expect(mockStreamAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'break_glass_deactivated',
            actorUid: 'u1',
            sessionId: 'existing-session',
        }));
    });
});
//# sourceMappingURL=break-glass.test.js.map