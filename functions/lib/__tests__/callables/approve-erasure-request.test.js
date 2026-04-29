/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { approveErasureRequestCore } from '../../callables/approve-erasure-request.js';
const { mockUpdateUser } = vi.hoisted(() => ({ mockUpdateUser: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ updateUser: mockUpdateUser }),
}));
vi.mock('../../services/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }));
let env;
async function seedRequest(db, id, status, citizenUid = 'uid-citizen') {
    await db
        .collection('erasure_requests')
        .doc(id)
        .set({ citizenUid, status, requestedAt: Date.now() });
    await db.collection('erasure_active').doc(citizenUid).set({ citizenUid, createdAt: Date.now() });
}
beforeEach(async () => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(undefined);
    env = await initializeTestEnvironment({
        projectId: 'demo-8c-approve',
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
describe('approveErasureRequestCore', () => {
    it('approve sets status to approved_pending_anonymization', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            await seedRequest(db, 'req-1', 'pending_review');
            await approveErasureRequestCore(db, getAuth(), { erasureRequestId: 'req-1', approved: true }, { uid: 'admin-1' });
            const snap = await db.collection('erasure_requests').doc('req-1').get();
            expect(snap.data().status).toBe('approved_pending_anonymization');
            expect(mockUpdateUser).not.toHaveBeenCalled();
        });
    });
    it('deny re-enables Auth, deletes sentinel, sets status to denied', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            await seedRequest(db, 'req-2', 'pending_review');
            await approveErasureRequestCore(db, getAuth(), { erasureRequestId: 'req-2', approved: false, reason: 'not valid' }, { uid: 'admin-1' });
            const snap = await db.collection('erasure_requests').doc('req-2').get();
            expect(snap.data().status).toBe('denied');
            expect(mockUpdateUser).toHaveBeenCalledWith('uid-citizen', { disabled: false });
            const sentinel = await db.collection('erasure_active').doc('uid-citizen').get();
            expect(sentinel.exists).toBe(false);
        });
    });
    it('throws failed-precondition when status is not pending_review', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            await seedRequest(db, 'req-3', 'approved_pending_anonymization');
            await expect(approveErasureRequestCore(db, getAuth(), { erasureRequestId: 'req-3', approved: true }, { uid: 'admin-1' })).rejects.toMatchObject({ code: 'failed-precondition' });
        });
    });
    it('re-disables Auth on deny transaction failure', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            await seedRequest(db, 'req-4', 'pending_review');
            mockUpdateUser
                .mockResolvedValueOnce(undefined) // re-enable succeeds
                .mockResolvedValueOnce(undefined); // re-disable succeeds
            // Force the transaction to fail with a non-domain error so rollback is triggered
            const originalRunTransaction = db.runTransaction.bind(db);
            db.runTransaction = () => Promise.reject(new Error('simulated tx failure'));
            await expect(approveErasureRequestCore(db, getAuth(), { erasureRequestId: 'req-4', approved: false, reason: 'nope' }, { uid: 'admin-1' })).rejects.toMatchObject({ code: 'internal' });
            expect(mockUpdateUser).toHaveBeenLastCalledWith('uid-citizen', { disabled: true });
            db.runTransaction = originalRunTransaction;
        });
    });
});
//# sourceMappingURL=approve-erasure-request.test.js.map