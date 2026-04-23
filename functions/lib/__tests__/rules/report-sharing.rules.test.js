import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js';
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-report-sharing');
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
    await seedActiveAccount(env, {
        uid: 'libman-admin',
        role: 'municipal_admin',
        municipalityId: 'libman',
    });
    await seedActiveAccount(env, {
        uid: 'super-1',
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet', 'mercedes'],
    });
    // Seed sharing doc owned by daet, shared with mercedes
    await env.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore();
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        await db
            .collection('report_sharing')
            .doc('r-share-1')
            .set({
            ownerMunicipalityId: 'daet',
            sharedWith: ['mercedes'],
            reportId: 'r-share-1',
            createdAt: 1713350400000,
            schemaVersion: 1,
        });
    });
});
afterAll(async () => {
    await env.cleanup();
});
describe('report_sharing rules', () => {
    it('owner municipality admin reads (positive)', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(getDoc(doc(db, 'report_sharing/r-share-1')));
    });
    it('recipient municipality admin whose myMunicipality() in sharedWith reads (positive)', async () => {
        const db = authed(env, 'mercedes-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }));
        await assertSucceeds(getDoc(doc(db, 'report_sharing/r-share-1')));
    });
    it('non-recipient admin fails (negative)', async () => {
        const db = authed(env, 'libman-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'libman' }));
        await assertFails(getDoc(doc(db, 'report_sharing/r-share-1')));
    });
    it('superadmin reads (positive)', async () => {
        const db = authed(env, 'super-1', staffClaims({
            role: 'provincial_superadmin',
            permittedMunicipalityIds: ['daet', 'mercedes'],
        }));
        await assertSucceeds(getDoc(doc(db, 'report_sharing/r-share-1')));
    });
    it('any client write fails', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        const { setDoc } = await import('firebase/firestore');
        await assertFails(setDoc(doc(db, 'report_sharing/new'), {
            ownerMunicipalityId: 'daet',
            sharedWith: ['mercedes'],
        }));
    });
    it('unauthed read fails', async () => {
        const db = unauthed(env);
        await assertFails(getDoc(doc(db, 'report_sharing/r-share-1')));
    });
});
//# sourceMappingURL=report-sharing.rules.test.js.map