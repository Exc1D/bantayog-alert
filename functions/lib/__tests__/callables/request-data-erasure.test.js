/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { requestDataErasureCore } from '../../callables/request-data-erasure.js';
const { mockUpdateUser } = vi.hoisted(() => ({ mockUpdateUser: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ updateUser: mockUpdateUser }),
}));
vi.mock('../../services/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }));
let env;
beforeEach(async () => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(undefined);
    env = await initializeTestEnvironment({
        projectId: 'demo-8c-erasure',
        firestore: { host: 'localhost', port: 8081 },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const col of ['erasure_requests', 'erasure_active']) {
            const snap = await db.collection(col).get();
            await Promise.all(snap.docs.map((d) => d.ref.delete()));
        }
    });
});
afterEach(async () => {
    await env?.cleanup();
});
describe('requestDataErasureCore', () => {
    it('creates erasure_requests doc and sentinel, then disables Auth', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            await requestDataErasureCore(db, getAuth(), { uid: 'user-1' });
            const reqSnap = await db
                .collection('erasure_requests')
                .where('citizenUid', '==', 'user-1')
                .get();
            expect(reqSnap.docs).toHaveLength(1);
            expect(reqSnap.docs[0]?.data().status).toBe('pending_review');
            expect(reqSnap.docs[0]?.data().legalHold).toBe(false);
            const sentinelSnap = await db.collection('erasure_active').doc('user-1').get();
            expect(sentinelSnap.exists).toBe(true);
            expect(mockUpdateUser).toHaveBeenCalledWith('user-1', { disabled: true });
        });
    });
    it('throws already-exists and does not call Auth if sentinel exists', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await db
                .collection('erasure_active')
                .doc('user-1')
                .set({ citizenUid: 'user-1', createdAt: Date.now() });
            const { getAuth } = await import('firebase-admin/auth');
            await expect(requestDataErasureCore(db, getAuth(), { uid: 'user-1' })).rejects.toMatchObject({
                code: 'already-exists',
            });
            expect(mockUpdateUser).not.toHaveBeenCalled();
        });
    });
    it('rolls back sentinel and request doc if Auth disable throws', async () => {
        mockUpdateUser.mockRejectedValueOnce(new Error('auth error'));
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            await expect(requestDataErasureCore(db, getAuth(), { uid: 'user-2' })).rejects.toMatchObject({
                code: 'internal',
            });
            const sentinelSnap = await db.collection('erasure_active').doc('user-2').get();
            expect(sentinelSnap.exists).toBe(false);
            const reqSnap = await db
                .collection('erasure_requests')
                .where('citizenUid', '==', 'user-2')
                .get();
            expect(reqSnap.docs).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=request-data-erasure.test.js.map