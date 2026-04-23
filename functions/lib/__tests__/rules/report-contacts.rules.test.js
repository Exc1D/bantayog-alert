import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js';
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-report-contacts');
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
        uid: 'resp-1',
        role: 'responder',
        agencyId: 'bfp',
        municipalityId: 'daet',
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        await db.collection('report_contacts').doc('r-contacts-1').set({
            municipalityId: 'daet',
            reportId: 'r-contacts-1',
            primaryContactName: 'Test Contact',
            primaryContactPhone: '+639000000001',
            alternateContactName: 'Alt Contact',
            alternateContactPhone: '+639000000002',
            createdAt: 1713350400000,
            schemaVersion: 1,
        });
    });
});
afterAll(async () => {
    await env.cleanup();
});
describe('report_contacts rules', () => {
    it('daet-admin reads own-muni (positive)', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(getDoc(doc(db, 'report_contacts/r-contacts-1')));
    });
    it('mercedes-admin fails (negative)', async () => {
        const db = authed(env, 'mercedes-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }));
        await assertFails(getDoc(doc(db, 'report_contacts/r-contacts-1')));
    });
    it('responder fails', async () => {
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', agencyId: 'bfp' }));
        await assertFails(getDoc(doc(db, 'report_contacts/r-contacts-1')));
    });
    it('any client write fails', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        const { setDoc } = await import('firebase/firestore');
        await assertFails(setDoc(doc(db, 'report_contacts/new'), {
            municipalityId: 'daet',
            reportId: 'new',
            primaryContactName: 'Test',
            primaryContactPhone: '+639000000001',
        }));
    });
    it('unauthed read fails', async () => {
        const db = unauthed(env);
        await assertFails(getDoc(doc(db, 'report_contacts/r-contacts-1')));
    });
});
//# sourceMappingURL=report-contacts.rules.test.js.map