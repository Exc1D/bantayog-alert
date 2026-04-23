import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js';
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-report-lookup');
    await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' });
    await seedActiveAccount(env, {
        uid: 'daet-admin',
        role: 'municipal_admin',
        municipalityId: 'daet',
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        await db.collection('report_lookup').doc('pub-ref-1').set({
            publicRef: 'pub-ref-1',
            reportId: 'r-lookup-1',
            createdAt: 1713350400000,
            schemaVersion: 1,
        });
    });
});
afterAll(async () => {
    await env.cleanup();
});
describe('report_lookup rules', () => {
    it('any authed user reads (positive)', async () => {
        const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
        await assertSucceeds(getDoc(doc(db, 'report_lookup/pub-ref-1')));
    });
    it('municipal admin reads (positive)', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(getDoc(doc(db, 'report_lookup/pub-ref-1')));
    });
    it('any client write fails', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        const { setDoc } = await import('firebase/firestore');
        await assertFails(setDoc(doc(db, 'report_lookup/new'), { publicRef: 'new', reportId: 'r-new' }));
    });
    it('unauthed read fails', async () => {
        const db = unauthed(env);
        await assertFails(getDoc(doc(db, 'report_lookup/pub-ref-1')));
    });
    it('unauthed write fails', async () => {
        const db = unauthed(env);
        const { setDoc } = await import('firebase/firestore');
        await assertFails(setDoc(doc(db, 'report_lookup/new'), { publicRef: 'new', reportId: 'r-new' }));
    });
});
//# sourceMappingURL=report-lookup.rules.test.js.map