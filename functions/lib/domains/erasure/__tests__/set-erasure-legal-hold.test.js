/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
import { setErasureLegalHoldCore } from '../set-erasure-legal-hold.js';
vi.mock('../../services/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }));
const guarded = await guardInitTestEnvironment({
    projectId: 'demo-8c-legalhold',
    firestore: { host: 'localhost', port: 8081 },
}, 'set-erasure-legal-hold');
const env = guarded.env;
const available = guarded.available;
const itif = (condition) => (condition ? it : it.skip);
beforeEach(async () => {
    if (!env)
        return;
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        const snap = await db.collection('erasure_requests').get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
    });
});
afterAll(async () => {
    await env?.cleanup();
});
describe('setErasureLegalHoldCore', () => {
    itif(available)('sets legalHold true on an approved_pending_anonymization request', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await db.collection('erasure_requests').doc('req-1').set({
                citizenUid: 'uid-1',
                status: 'approved_pending_anonymization',
                legalHold: false,
                requestedAt: Date.now(),
            });
            await setErasureLegalHoldCore(db, { erasureRequestId: 'req-1', hold: true, reason: 'court order' }, { uid: 'admin-1' });
            const snap = await db.collection('erasure_requests').doc('req-1').get();
            expect(snap.data().legalHold).toBe(true);
            expect(snap.data().legalHoldReason).toBe('court order');
            expect(snap.data().legalHoldSetBy).toBe('admin-1');
        });
    });
    itif(available)('clears legalHold on an existing hold', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await db.collection('erasure_requests').doc('req-2').set({
                citizenUid: 'uid-2',
                status: 'approved_pending_anonymization',
                legalHold: true,
                requestedAt: Date.now(),
            });
            await setErasureLegalHoldCore(db, { erasureRequestId: 'req-2', hold: false, reason: 'court lifted' }, { uid: 'admin-1' });
            const snap = await db.collection('erasure_requests').doc('req-2').get();
            expect(snap.data().legalHold).toBe(false);
        });
    });
    itif(available)('throws not-found for missing request', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await expect(setErasureLegalHoldCore(db, { erasureRequestId: 'nope', hold: true, reason: 'x' }, { uid: 'admin-1' })).rejects.toMatchObject({ code: 'not-found' });
        });
    });
    itif(available)('throws failed-precondition on completed request', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await db
                .collection('erasure_requests')
                .doc('req-3')
                .set({ citizenUid: 'uid-3', status: 'completed', requestedAt: Date.now() });
            await expect(setErasureLegalHoldCore(db, { erasureRequestId: 'req-3', hold: true, reason: 'x' }, { uid: 'admin-1' })).rejects.toMatchObject({ code: 'failed-precondition' });
        });
    });
    itif(available)('throws failed-precondition on denied request', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await db
                .collection('erasure_requests')
                .doc('req-denied')
                .set({ citizenUid: 'uid-d', status: 'denied', requestedAt: Date.now() });
            await expect(setErasureLegalHoldCore(db, { erasureRequestId: 'req-denied', hold: true, reason: 'x' }, { uid: 'admin-1' })).rejects.toMatchObject({ code: 'failed-precondition' });
        });
    });
});
//# sourceMappingURL=set-erasure-legal-hold.test.js.map