/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv } from '../helpers/rules-harness.js';
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-3c-responder');
    await seedActiveAccount(env, {
        uid: 'daet-admin',
        role: 'municipal_admin',
        municipalityId: 'daet',
    });
    await seedActiveAccount(env, {
        uid: 'resp-1',
        role: 'responder',
        municipalityId: 'daet',
        agencyId: 'bfp',
    });
});
afterAll(async () => {
    await env.cleanup();
});
describe('responder direct-write on dispatches/{id}', () => {
    it('allows assigned responder to transition accepted → acknowledged', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'dispatches/dispatch-1'), {
                status: 'accepted',
                assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                lastStatusAt: Date.now(),
                acknowledgementDeadlineAt: Date.now() + 900000,
                reportId: 'report-1',
                dispatchedBy: 'daet-admin',
                dispatchedByRole: 'municipal_admin',
                dispatchedAt: Date.now(),
                idempotencyKey: 'key-1',
                idempotencyPayloadHash: 'a'.repeat(64),
                schemaVersion: 1,
            });
        });
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertSucceeds(db.collection('dispatches').doc('dispatch-1').update({
            status: 'acknowledged',
            lastStatusAt: FieldValue.serverTimestamp(),
        }));
    });
    it('denies acknowledged → resolved (skipping en_route/on_scene)', async () => {
        const db = env.unauthenticatedContext().firestore();
        await setDoc(doc(db, 'dispatches/d-2'), {
            status: 'acknowledged',
            responderUid: 'resp-1',
            municipalityId: 'daet',
        });
        const authedDb = authed(env, 'resp-1', {
            role: 'responder',
            municipalityId: 'daet',
            agencyId: 'bfp',
        });
        await assertFails(setDoc(doc(authedDb, 'dispatches/d-2'), { status: 'resolved' }, { merge: true }));
    });
    it('denies acknowledged → cancelled (responder cannot cancel)', async () => {
        const db = env.unauthenticatedContext().firestore();
        await setDoc(doc(db, 'dispatches/d-3'), {
            status: 'acknowledged',
            assignedTo: { uid: 'resp-1' },
            municipalityId: 'daet',
        });
        const authedDb = authed(env, 'resp-1', {
            role: 'responder',
            municipalityId: 'daet',
            agencyId: 'bfp',
        });
        await assertFails(setDoc(doc(authedDb, 'dispatches/d-3'), { status: 'cancelled' }, { merge: true }));
    });
    it('denies on_scene → resolved without resolutionSummary', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'dispatches/dispatch-3'), {
                status: 'on_scene',
                assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                lastStatusAt: Date.now(),
                acknowledgementDeadlineAt: Date.now() + 900000,
                reportId: 'report-3',
                dispatchedBy: 'daet-admin',
                dispatchedByRole: 'municipal_admin',
                dispatchedAt: Date.now(),
                idempotencyKey: 'key-3',
                idempotencyPayloadHash: 'c'.repeat(64),
                schemaVersion: 1,
            });
        });
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertFails(db.collection('dispatches').doc('dispatch-3').update({
            status: 'resolved',
            lastStatusAt: FieldValue.serverTimestamp(),
        }));
    });
    it('allows on_scene → resolved with resolutionSummary', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'dispatches/dispatch-4'), {
                status: 'on_scene',
                assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                lastStatusAt: Date.now(),
                acknowledgementDeadlineAt: Date.now() + 900000,
                reportId: 'report-4',
                dispatchedBy: 'daet-admin',
                dispatchedByRole: 'municipal_admin',
                dispatchedAt: Date.now(),
                idempotencyKey: 'key-4',
                idempotencyPayloadHash: 'd'.repeat(64),
                schemaVersion: 1,
            });
        });
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertSucceeds(db.collection('dispatches').doc('dispatch-4').update({
            status: 'resolved',
            lastStatusAt: FieldValue.serverTimestamp(),
            resolutionSummary: 'Secured the area, no injuries reported.',
        }));
    });
    it('denies writes by a different responder', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'dispatches/dispatch-5'), {
                status: 'accepted',
                assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                lastStatusAt: Date.now(),
                acknowledgementDeadlineAt: Date.now() + 900000,
                reportId: 'report-5',
                dispatchedBy: 'daet-admin',
                dispatchedByRole: 'municipal_admin',
                dispatchedAt: Date.now(),
                idempotencyKey: 'key-5',
                idempotencyPayloadHash: 'e'.repeat(64),
                schemaVersion: 1,
            });
        });
        const strangerUid = 'other-responder';
        await seedActiveAccount(env, {
            uid: strangerUid,
            role: 'responder',
            municipalityId: 'daet',
            agencyId: 'bfp',
        });
        const db = authed(env, strangerUid, staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertFails(db
            .collection('dispatches')
            .doc('dispatch-5')
            .update({ status: 'acknowledged', lastStatusAt: FieldValue.serverTimestamp() }));
    });
    it('denies writes that touch fields outside the allowlist', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'dispatches/dispatch-6'), {
                status: 'accepted',
                assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                lastStatusAt: Date.now(),
                acknowledgementDeadlineAt: Date.now() + 900000,
                reportId: 'report-6',
                dispatchedBy: 'daet-admin',
                dispatchedByRole: 'municipal_admin',
                dispatchedAt: Date.now(),
                idempotencyKey: 'key-6',
                idempotencyPayloadHash: 'f'.repeat(64),
                schemaVersion: 1,
            });
        });
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertFails(db
            .collection('dispatches')
            .doc('dispatch-6')
            .update({
            status: 'acknowledged',
            lastStatusAt: FieldValue.serverTimestamp(),
            assignedTo: { uid: 'someone-else', agencyId: 'bfp', municipalityId: 'daet' },
        }));
    });
});
//# sourceMappingURL=responder-direct-writes.rules.test.js.map