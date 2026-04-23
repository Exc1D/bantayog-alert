/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setDoc, doc } from 'firebase/firestore';
const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules');
const ts = 1713350400000;
let testEnv;
function seedReport(db, reportId, municipalityId, status) {
    return setDoc(doc(db, 'reports', reportId), {
        reportId,
        status,
        municipalityId,
        municipalityLabel: 'Daet',
        source: 'citizen_pwa',
        severityDerived: 'medium',
        correlationId: crypto.randomUUID(),
        visibilityClass: 'internal',
        createdAt: ts,
        lastStatusAt: ts,
        lastStatusBy: 'system:seed',
        schemaVersion: 1,
    });
}
beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'admin-onsnapshot-rules-test',
        firestore: {
            rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
        },
    });
    await testEnv.clearFirestore();
});
describe('admin muni-scoped onSnapshot queue', () => {
    it('allows muni admin to read reports filtered by own municipalityId + queue statuses', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await seedReport(db, 'r1', 'daet', 'new');
            await seedReport(db, 'r2', 'daet', 'awaiting_verify');
            await setDoc(doc(db, 'users', 'admin-1'), {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
                isActive: true,
                schemaVersion: 1,
            });
        });
        const adminDb = testEnv
            .authenticatedContext('admin-1', {
            role: 'municipal_admin',
            municipalityId: 'daet',
            accountStatus: 'active',
        })
            .firestore();
        await assertSucceeds(adminDb
            .collection('reports')
            .where('municipalityId', '==', 'daet')
            .where('status', 'in', ['new', 'awaiting_verify'])
            .get());
    });
    it('denies cross-muni reads', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await seedReport(db, 'rx', 'mercedes', 'new');
            await setDoc(doc(db, 'users', 'admin-1'), {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
                isActive: true,
                schemaVersion: 1,
            });
        });
        const adminDb = testEnv
            .authenticatedContext('admin-1', {
            role: 'municipal_admin',
            municipalityId: 'daet',
            accountStatus: 'active',
        })
            .firestore();
        await assertFails(adminDb.collection('reports').where('municipalityId', '==', 'mercedes').get());
    });
    it('denies unauthenticated reads', async () => {
        const anon = testEnv.unauthenticatedContext().firestore();
        await assertFails(anon.collection('reports').where('municipalityId', '==', 'daet').get());
    });
    it('denies citizen-role reads', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'cit-1'), {
                uid: 'cit-1',
                role: 'citizen',
                isActive: true,
                schemaVersion: 1,
            });
        });
        const citDb = testEnv
            .authenticatedContext('cit-1', { role: 'citizen', accountStatus: 'active' })
            .firestore();
        await assertFails(citDb.collection('reports').where('municipalityId', '==', 'daet').get());
    });
});
//# sourceMappingURL=admin-onsnapshot.rules.test.js.map