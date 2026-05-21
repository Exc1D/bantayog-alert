import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
const itif = (condition) => (condition ? it : it.skip);
import { setDoc, doc } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }));
const { onCallMock } = vi.hoisted(() => ({
    onCallMock: vi.fn((_config, handler) => handler),
}));
vi.mock('firebase-functions/v2/https', async () => {
    const actual = await vi.importActual('firebase-functions/v2/https');
    return {
        ...actual,
        onCall: onCallMock,
    };
});
let adminDb;
vi.mock('../../../admin-init.js', () => ({
    get adminDb() {
        return adminDb;
    },
}));
import { enterFieldMode, exitFieldMode, enterFieldModeCore, exitFieldModeCore, } from '../field-mode.js';
const ts = 1713350400000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
let testEnv;
let available = false;
beforeAll(async () => {
    const guarded = await guardInitTestEnvironment({
        projectId: 'field-mode-test',
        firestore: {
            host: 'localhost',
            port: 8081,
            rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
        },
    }, 'field-mode');
    testEnv = guarded.env;
    available = guarded.available;
    if (!available)
        return;
    adminDb = testEnv.unauthenticatedContext().firestore();
});
beforeEach(async () => {
    if (!available || !testEnv)
        return;
    await testEnv.clearFirestore();
});
afterAll(async () => {
    await testEnv?.cleanup();
});
describe('enterFieldModeCore', () => {
    itif(available)('rejects a muni admin whose auth_time is more than 4 hours ago', async () => {
        // auth_time is Unix seconds; stale means > 4 hours ago
        const staleAuthTime = Math.floor((ts - FOUR_HOURS_MS - 1000) / 1000);
        await expect(enterFieldModeCore(adminDb, {
            actor: {
                uid: 'daet-admin',
                claims: {
                    role: 'municipal_admin',
                    accountStatus: 'active',
                    municipalityId: 'daet',
                    auth_time: staleAuthTime,
                },
            },
            now: Timestamp.fromMillis(ts),
        })).rejects.toMatchObject({ code: 'unauthenticated' });
    });
    itif(available)('creates field_mode_sessions with isActive true and 12h expiry', async () => {
        const freshAuthTime = Math.floor((ts - 60000) / 1000); // 1 minute ago
        await enterFieldModeCore(adminDb, {
            actor: {
                uid: 'daet-admin',
                claims: {
                    role: 'municipal_admin',
                    accountStatus: 'active',
                    municipalityId: 'daet',
                    auth_time: freshAuthTime,
                },
            },
            now: Timestamp.fromMillis(ts),
        });
        const snap = await adminDb.collection('field_mode_sessions').doc('daet-admin').get();
        expect(snap.data()?.isActive).toBe(true);
        expect(snap.data()?.expiresAt).toBe(ts + TWELVE_HOURS_MS);
    });
    itif(available)('rejects citizens and responders', async () => {
        for (const role of ['citizen', 'responder']) {
            await expect(enterFieldModeCore(adminDb, {
                actor: {
                    uid: 'u1',
                    claims: {
                        role,
                        accountStatus: 'active',
                        municipalityId: 'daet',
                        auth_time: Math.floor(ts / 1000),
                    },
                },
                now: Timestamp.fromMillis(ts),
            })).rejects.toMatchObject({ code: 'permission-denied' });
        }
    });
    itif(available)('rejects inactive accounts', async () => {
        await expect(enterFieldModeCore(adminDb, {
            actor: {
                uid: 'daet-admin',
                claims: {
                    role: 'municipal_admin',
                    accountStatus: 'suspended',
                    municipalityId: 'daet',
                    auth_time: Math.floor((ts - 60000) / 1000),
                },
            },
            now: Timestamp.fromMillis(ts),
        })).rejects.toMatchObject({ code: 'permission-denied' });
    });
});
describe('exitFieldModeCore', () => {
    itif(available)('sets isActive false and records exitedAt', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'field_mode_sessions', 'daet-admin'), {
                uid: 'daet-admin',
                municipalityId: 'daet',
                enteredAt: ts - 60000,
                expiresAt: ts + TWELVE_HOURS_MS,
                isActive: true,
                schemaVersion: 1,
            });
        });
        await exitFieldModeCore(adminDb, {
            actor: {
                uid: 'daet-admin',
                claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
            },
            now: Timestamp.fromMillis(ts),
        });
        const snap = await adminDb.collection('field_mode_sessions').doc('daet-admin').get();
        expect(snap.data()?.isActive).toBe(false);
        expect(snap.data()?.exitedAt).toBe(ts);
    });
    itif(available)('is idempotent — double-exit returns success without throwing', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'field_mode_sessions', 'daet-admin'), {
                uid: 'daet-admin',
                municipalityId: 'daet',
                isActive: false,
                exitedAt: ts - 60000,
                enteredAt: ts - 120000,
                expiresAt: ts + TWELVE_HOURS_MS,
                schemaVersion: 1,
            });
        });
        await expect(exitFieldModeCore(adminDb, {
            actor: {
                uid: 'daet-admin',
                claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
            },
            now: Timestamp.fromMillis(ts),
        })).resolves.toEqual({ status: 'exited' });
    });
    itif(available)('returns exited for non-existent session', async () => {
        const result = await exitFieldModeCore(adminDb, {
            actor: {
                uid: 'ghost-admin',
                claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
            },
            now: Timestamp.fromMillis(ts),
        });
        expect(result).toEqual({ status: 'exited' });
    });
});
describe('enterFieldMode callable', () => {
    const callEnterFieldMode = enterFieldMode;
    itif(available)('wires App Check config from shouldEnforceAppCheck', () => {
        const shouldEnforce = true;
        expect(onCallMock).toHaveBeenCalledWith(expect.objectContaining({
            region: 'asia-southeast1',
            enforceAppCheck: shouldEnforce,
        }), expect.any(Function));
    });
    itif(available)('accepts an authenticated municipal_admin with fresh token', async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const freshAuthTime = nowSec - 60; // 1 minute ago
        const result = await callEnterFieldMode({
            auth: {
                uid: 'daet-admin',
                token: {
                    role: 'municipal_admin',
                    accountStatus: 'active',
                    municipalityId: 'daet',
                    auth_time: freshAuthTime,
                },
            },
        });
        expect(result.status).toBe('entered');
        expect(result.expiresAt).toBeGreaterThan(Date.now());
    });
    itif(available)('rejects unauthenticated request', async () => {
        await expect(callEnterFieldMode({})).rejects.toMatchObject({ code: 'unauthenticated' });
    });
});
describe('exitFieldMode callable', () => {
    const callExitFieldMode = exitFieldMode;
    itif(available)('wires App Check config from shouldEnforceAppCheck', () => {
        const shouldEnforce = true;
        // Find calls for exitFieldMode (second call)
        const calls = onCallMock.mock.calls.filter(([, handler]) => handler != null);
        expect(calls.length).toBeGreaterThanOrEqual(2);
        // The second call (exitFieldMode) should match
        const exitCall = calls[1];
        expect(exitCall[0]).toMatchObject({
            region: 'asia-southeast1',
            enforceAppCheck: shouldEnforce,
        });
    });
    itif(available)('accepts an authenticated admin and exits field mode', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'field_mode_sessions', 'daet-admin'), {
                uid: 'daet-admin',
                municipalityId: 'daet',
                enteredAt: ts - 60000,
                expiresAt: ts + TWELVE_HOURS_MS,
                isActive: true,
                schemaVersion: 1,
            });
        });
        const result = await callExitFieldMode({
            auth: {
                uid: 'daet-admin',
                token: {
                    role: 'municipal_admin',
                    accountStatus: 'active',
                    municipalityId: 'daet',
                },
            },
        });
        expect(result).toEqual({ status: 'exited' });
    });
    itif(available)('rejects unauthenticated request', async () => {
        await expect(callExitFieldMode({})).rejects.toMatchObject({ code: 'unauthenticated' });
    });
});
//# sourceMappingURL=field-mode.test.js.map