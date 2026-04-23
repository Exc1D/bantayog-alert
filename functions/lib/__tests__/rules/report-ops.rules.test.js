import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv } from '../helpers/rules-harness.js';
import { seedActiveAccount, seedReport, staffClaims } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-report-ops');
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
    await seedActiveAccount(env, { uid: 'bfp-admin', role: 'agency_admin', agencyId: 'bfp' });
    await seedActiveAccount(env, { uid: 'pcg-admin', role: 'agency_admin', agencyId: 'pcg' });
    // r-ops has agencyIds: ['bfp']
    await seedReport(env, 'r-ops', {
        opsOverrides: { agencyIds: ['bfp'] },
    });
});
afterAll(async () => {
    await env.cleanup();
});
describe('report_ops rules', () => {
    it('daet-admin reads own-muni ops (positive)', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(getDoc(doc(db, 'report_ops/r-ops')));
    });
    it('agency admin whose myAgency() in resource.data.agencyIds reads ops (positive)', async () => {
        const db = authed(env, 'bfp-admin', staffClaims({ role: 'agency_admin', agencyId: 'bfp' }));
        await assertSucceeds(getDoc(doc(db, 'report_ops/r-ops')));
    });
    it('agency admin not in agencyIds fails (negative)', async () => {
        const db = authed(env, 'pcg-admin', staffClaims({ role: 'agency_admin', agencyId: 'pcg' }));
        await assertFails(getDoc(doc(db, 'report_ops/r-ops')));
    });
    it('mercedes-admin fails (cross-muni negative)', async () => {
        const db = authed(env, 'mercedes-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }));
        await assertFails(getDoc(doc(db, 'report_ops/r-ops')));
    });
    it('responder fails (no role path granted)', async () => {
        const db = authed(env, 'resp-1', staffClaims({ role: 'responder', agencyId: 'bfp' }));
        await assertFails(getDoc(doc(db, 'report_ops/r-ops')));
    });
    it('any client write fails', async () => {
        const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        const { setDoc } = await import('firebase/firestore');
        await assertFails(setDoc(doc(db, 'report_ops/new'), { municipalityId: 'daet', agencyIds: ['bfp'] }));
    });
});
//# sourceMappingURL=report-ops.rules.test.js.map