import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
const itif = (condition) => (condition ? it : it.skip);
import { Timestamp } from 'firebase-admin/firestore';
vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({})),
}));
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
vi.mock('../../admin-init.js', () => ({
    get adminDb() {
        return adminDb;
    },
}));
import { triggerSOS, triggerSosCore } from '../trigger-sos.js';
import { seedActiveAccount } from '../../../__tests__/helpers/seed-factories.js';
let testEnv;
let available = false;
beforeAll(async () => {
    const guarded = await guardInitTestEnvironment({
        projectId: 'trigger-sos-test',
        firestore: {
            host: 'localhost',
            port: 8081,
            rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
        },
    }, 'trigger-sos');
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
async function seedDispatchActive(env, dispatchId, reportId, responderUid, status, overrides = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db
            .collection('dispatches')
            .doc(dispatchId)
            .set({
            dispatchId,
            reportId,
            status,
            assignedTo: {
                uid: responderUid,
                agencyId: 'bfp-daet',
                municipalityId: 'daet',
            },
            dispatchedAt: Date.now(),
            lastStatusAt: Date.now(),
            schemaVersion: 1,
            ...overrides,
        });
    });
}
describe('triggerSosCore', () => {
    itif(available)('sets sosTriggeredAt for an active dispatch', async () => {
        await seedDispatchActive(testEnv, 'dispatch-1', 'report-1', 'r1', 'on_scene');
        await seedActiveAccount(testEnv, {
            uid: 'r1',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const result = await triggerSosCore(db, {
                dispatchId: 'dispatch-1',
                actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            });
            expect(result.status).toBe('sos_triggered');
            const dispatch = (await db.collection('dispatches').doc('dispatch-1').get()).data();
            expect(dispatch?.sosTriggeredAt).toBeDefined();
            const notifications = await db
                .collection('admin_notifications')
                .where('type', '==', 'sos_triggered')
                .get();
            expect(notifications.docs).toHaveLength(1);
        });
    });
    itif(available)('rejects when SOS already triggered (rate limit)', async () => {
        await seedDispatchActive(testEnv, 'dispatch-2', 'report-2', 'r1', 'on_scene', {
            sosTriggeredAt: Date.now(),
        });
        await seedActiveAccount(testEnv, {
            uid: 'r1',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await expect(triggerSosCore(db, {
                dispatchId: 'dispatch-2',
                actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
        });
    });
    itif(available)('rejects when dispatch is not active', async () => {
        await seedDispatchActive(testEnv, 'dispatch-3', 'report-3', 'r1', 'pending');
        await seedActiveAccount(testEnv, {
            uid: 'r1',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await expect(triggerSosCore(db, {
                dispatchId: 'dispatch-3',
                actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
        });
    });
    itif(available)('rejects when caller is not the assigned responder', async () => {
        await seedDispatchActive(testEnv, 'dispatch-4', 'report-4', 'r1', 'on_scene');
        await seedActiveAccount(testEnv, {
            uid: 'r2',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await expect(triggerSosCore(db, {
                dispatchId: 'dispatch-4',
                actor: { uid: 'r2', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
    });
});
describe('triggerSOS callable', () => {
    const callCallable = triggerSOS;
    itif(available)('rejects unauthenticated request', async () => {
        await expect(callCallable({
            data: { dispatchId: 'dispatch-x' },
        })).rejects.toMatchObject({ code: 'unauthenticated' });
    });
    itif(available)('rejects wrong-role request', async () => {
        await expect(callCallable({
            auth: {
                uid: 'admin-1',
                token: { role: 'municipal_admin', accountStatus: 'active' },
            },
            data: { dispatchId: 'dispatch-x' },
        })).rejects.toMatchObject({ code: 'permission-denied' });
    });
});
//# sourceMappingURL=trigger-sos.test.js.map