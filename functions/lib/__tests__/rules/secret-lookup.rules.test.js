import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js';
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-secret-lookup');
    await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' });
    await seedActiveAccount(env, {
        uid: 'daet-admin',
        role: 'municipal_admin',
        municipalityId: 'daet',
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore();
        await db
            .collection('secret_lookup')
            .doc('hash-1')
            .set({
            publicRef: 'pub-ref-1',
            reportId: 'r-1',
            expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        });
    });
});
afterAll(async () => {
    await env.cleanup();
});
describe('secret_lookup rules', () => {
    it('authed user reads (positive)', async () => {
        const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
        await assertSucceeds(getDoc(doc(db, 'secret_lookup/hash-1')));
    });
    it('municipal admin reads (positive)', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(getDoc(doc(db, 'secret_lookup/hash-1')));
    });
    it('unauthed read fails (negative)', async () => {
        const db = unauthed(env);
        await assertFails(getDoc(doc(db, 'secret_lookup/hash-1')));
    });
    it('any client write fails (negative)', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(setDoc(doc(db, 'secret_lookup/new'), {
            publicRef: 'new',
            reportId: 'r-new',
            expiresAt: Date.now(),
        }));
    });
    it('unauthed write fails (negative)', async () => {
        const db = unauthed(env);
        await assertFails(setDoc(doc(db, 'secret_lookup/new'), {
            publicRef: 'new',
            reportId: 'r-new',
            expiresAt: Date.now(),
        }));
    });
});
//# sourceMappingURL=secret-lookup.rules.test.js.map