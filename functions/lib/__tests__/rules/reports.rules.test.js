import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv } from '../helpers/rules-harness.js';
import { seedActiveAccount, seedReport, staffClaims, ts } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-reports');
    await seedActiveAccount(env, {
        uid: 'daet-admin',
        role: 'municipal_admin',
        municipalityId: 'daet',
    });
    await seedActiveAccount(env, {
        uid: 'mercedes-admin',
        role: 'municipal_admin',
        municipalityId: 'mercedes',
    });
    await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' });
    await seedReport(env, 'r-public', { visibilityClass: 'public_alertable' });
    await seedReport(env, 'r-internal', { visibilityClass: 'internal' });
});
afterAll(async () => {
    await env.cleanup();
});
describe('reports rules', () => {
    it('any authed user reads a public_alertable report', async () => {
        const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
        await assertSucceeds(getDoc(doc(db, 'reports/r-public')));
    });
    it('non-municipality admin cannot read an internal report', async () => {
        const db = authed(env, 'mercedes-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }));
        await assertFails(getDoc(doc(db, 'reports/r-internal')));
    });
    it('municipality admin reads their own internal report', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(getDoc(doc(db, 'reports/r-internal')));
    });
    it('municipality admin may update mutable fields', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(updateDoc(doc(db, 'reports/r-internal'), { status: 'assigned', updatedAt: ts }));
    });
    it('municipality admin cannot mutate immutable fields like municipalityId', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(updateDoc(doc(db, 'reports/r-internal'), { municipalityId: 'mercedes' }));
    });
});
//# sourceMappingURL=reports.rules.test.js.map