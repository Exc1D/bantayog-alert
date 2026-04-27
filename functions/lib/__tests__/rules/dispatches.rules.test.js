import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv } from '../helpers/rules-harness.js';
import { seedActiveAccount, seedDispatchRT, staffClaims, ts } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-dispatches');
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
    await seedDispatchRT(env, 'dispatch-1', {
        municipalityId: 'daet',
        status: 'accepted',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
    });
});
afterAll(async () => {
    await env.cleanup();
});
describe('dispatches rules', () => {
    it('municipality admin reads their own dispatches', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(getDoc(doc(db, 'dispatches/dispatch-1')));
    });
    it('other municipality admin cannot read dispatches', async () => {
        const db = authed(env, 'some-other-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'other' }));
        await assertFails(getDoc(doc(db, 'dispatches/dispatch-1')));
    });
    it('assigned responder can read their dispatch', async () => {
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertSucceeds(getDoc(doc(db, 'dispatches/dispatch-1')));
    });
    it('responder can update status with valid transition', async () => {
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertSucceeds(updateDoc(doc(db, 'dispatches/dispatch-1'), { status: 'acknowledged', updatedAt: ts }));
    });
    it('responder cannot update with invalid status transition', async () => {
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }));
        await assertFails(updateDoc(doc(db, 'dispatches/dispatch-1'), { status: 'resolved', updatedAt: ts }));
    });
});
//# sourceMappingURL=dispatches.rules.test.js.map