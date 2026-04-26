import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds, } from '@firebase/rules-unit-testing';
import { createTestEnv, authed } from '../helpers/rules-harness.js';
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js';
import { setDoc, getDoc, doc, deleteDoc } from 'firebase/firestore';
let testEnv;
beforeAll(async () => {
    testEnv = await createTestEnv('mass-alert-rules-test');
});
beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedActiveAccount(testEnv, {
        uid: 'admin-uid',
        role: 'municipal_admin',
        municipalityId: 'daet',
    });
    await seedActiveAccount(testEnv, {
        uid: 'super-admin',
        role: 'provincial_superadmin',
    });
    await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
    });
});
afterAll(async () => {
    await testEnv.cleanup();
});
const now = 1713350400000;
function baseAlert(status) {
    return {
        requestedByMunicipality: 'daet',
        requestedByUid: 'admin-uid',
        severity: 'high',
        body: 'Typhoon warning',
        targetType: 'municipality',
        estimatedReach: 5000,
        status,
        createdAt: now,
        schemaVersion: 1,
    };
}
describe('mass_alert_requests rules', () => {
    it('allows muni admin to create a request with status queued', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(setDoc(doc(db, 'mass_alert_requests', 'req-1'), baseAlert('queued')));
    });
    it('allows muni admin to create a request with status pending_ndrrmc_review', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(setDoc(doc(db, 'mass_alert_requests', 'req-2'), baseAlert('pending_ndrrmc_review')));
    });
    it('denies creation with status forwarded_to_ndrrmc (superadmin-only transition)', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-3'), baseAlert('forwarded_to_ndrrmc')));
    });
    it('denies citizen writes', async () => {
        const db = authed(testEnv, 'citizen-1', staffClaims({ role: 'citizen' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-4'), baseAlert('queued')));
    });
    it('allows muni admin to read own municipality request', async () => {
        const adminDb = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(setDoc(doc(adminDb, 'mass_alert_requests', 'read-1'), baseAlert('queued')));
        await assertSucceeds(getDoc(doc(adminDb, 'mass_alert_requests', 'read-1')));
    });
    it('allows active superadmin to read any request', async () => {
        const adminDb = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(setDoc(doc(adminDb, 'mass_alert_requests', 'read-2'), baseAlert('queued')));
        const superDb = authed(testEnv, 'super-admin', staffClaims({ role: 'provincial_superadmin' }));
        await assertSucceeds(getDoc(doc(superDb, 'mass_alert_requests', 'read-2')));
    });
    it('denies read for inactive privileged account', async () => {
        const inactiveDb = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet', accountStatus: 'suspended' }));
        await assertFails(getDoc(doc(inactiveDb, 'mass_alert_requests', 'read-3')));
    });
    // ================================================================
    // ADVERSARIAL TESTS — 17 tests covering security requirements
    // ================================================================
    // 1. Cross-municipality create - deny when admin's municipality doesn't match requestedByMunicipality
    it('denies cross-municipality create', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        // admin is from 'daet' but tries to create request for 'pasacao'
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-cross'), {
            ...baseAlert('queued'),
            requestedByMunicipality: 'pasacao',
        }));
    });
    // 2. Missing requestedByMunicipality - deny when field is missing
    it('denies missing requestedByMunicipality', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        const alertWithoutMuni = { ...baseAlert('queued') };
        delete alertWithoutMuni.requestedByMunicipality;
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-no-muni'), alertWithoutMuni));
    });
    // 3. Missing status - deny when status field is missing
    it('denies missing status field', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        const alertWithoutStatus = { ...baseAlert('queued') };
        delete alertWithoutStatus.status;
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-no-status'), alertWithoutStatus));
    });
    // 4. Invalid status values - deny for 'approved', 'rejected', 'forwarded_to_ndrrmc'
    it('denies status approved', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-approved'), baseAlert('approved')));
    });
    it('denies status rejected', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-rejected'), baseAlert('rejected')));
    });
    it('denies status forwarded_to_ndrrmc', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-forwarded'), baseAlert('forwarded_to_ndrrmc')));
    });
    // 5. Muni admin update denied - deny update (rules allow superadmin only)
    it('denies muni admin update', async () => {
        const adminDb = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        // First seed a document with rules disabled
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'mass_alert_requests', 'req-for-update'), baseAlert('queued'));
        });
        // Then try to update as muni admin - should fail
        await assertFails(setDoc(doc(adminDb, 'mass_alert_requests', 'req-for-update'), { status: 'pending_ndrrmc_review' }, { merge: true }));
    });
    // 6. Superadmin create queued - allow
    it('allows superadmin create queued', async () => {
        const db = authed(testEnv, 'super-admin', staffClaims({ role: 'provincial_superadmin' }));
        await assertSucceeds(setDoc(doc(db, 'mass_alert_requests', 'req-super'), {
            ...baseAlert('queued'),
            requestedByUid: 'super-admin', // must match auth uid
        }));
    });
    // 6b. Superadmin create denied when requestedByMunicipality is missing
    it('denies superadmin create when requestedByMunicipality is missing', async () => {
        const db = authed(testEnv, 'super-admin', staffClaims({ role: 'provincial_superadmin' }));
        const payload = { ...baseAlert('queued'), requestedByUid: 'super-admin' };
        delete payload.requestedByMunicipality;
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-super-missing-muni'), payload));
    });
    // 7. Cross-municipality read denied - deny read for other municipality's docs
    it('denies cross-municipality read', async () => {
        // Seed a document in daet municipality
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'mass_alert_requests', 'req-daet'), baseAlert('queued'));
        });
        // Try to read as admin from different municipality
        const otherDb = authed(testEnv, 'other-admin', staffClaims({ role: 'municipal_admin', municipalityId: 'pasacao' }));
        await seedActiveAccount(testEnv, {
            uid: 'other-admin',
            role: 'municipal_admin',
            municipalityId: 'pasacao',
        });
        await assertFails(getDoc(doc(otherDb, 'mass_alert_requests', 'req-daet')));
    });
    // 8. Suspended account denied - deny when accountStatus is 'suspended'
    it('denies suspended account create', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet', accountStatus: 'suspended' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-suspended'), baseAlert('queued')));
    });
    // 9. Superadmin update allowed - allow superadmin to update any request
    it('allows superadmin update', async () => {
        // Seed a document
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'mass_alert_requests', 'req-super-update'), baseAlert('queued'));
        });
        // Superadmin can update
        const superDb = authed(testEnv, 'super-admin', staffClaims({ role: 'provincial_superadmin' }));
        await assertSucceeds(setDoc(doc(superDb, 'mass_alert_requests', 'req-super-update'), { status: 'sent' }, { merge: true }));
    });
    // 10. Delete always denied - deny delete for all users
    it('denies delete for all users', async () => {
        const adminDb = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(deleteDoc(doc(adminDb, 'mass_alert_requests', 'req-to-delete')));
    });
    // 11. 'sent' status denied on client create - CRITICAL: 'sent' NOT allowed via client SDK
    it('denies sent status on client create', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-sent'), baseAlert('sent')));
    });
    // 12. requestedByUid must match uid() - CRITICAL: deny if requestedByUid doesn't match authenticated user's UID
    it('denies requestedByUid mismatch', async () => {
        const otherDb = authed(testEnv, 'other-admin-for-uid-test', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await seedActiveAccount(testEnv, {
            uid: 'other-admin-for-uid-test',
            role: 'municipal_admin',
            municipalityId: 'daet',
        });
        // Try to create with requestedByUid that doesn't match auth UID
        await assertFails(setDoc(doc(otherDb, 'mass_alert_requests', 'req-uid-mismatch'), {
            ...baseAlert('queued'),
            requestedByUid: 'admin-uid', // doesn't match auth UID 'other-admin-for-uid-test'
        }));
    });
    // 13. Superadmin update only allowed fields - verify superadmin can only update specific fields
    it('allows superadmin update status only', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'mass_alert_requests', 'req-status-update'), baseAlert('queued'));
        });
        const superDb = authed(testEnv, 'super-admin', staffClaims({ role: 'provincial_superadmin' }));
        await assertSucceeds(setDoc(doc(superDb, 'mass_alert_requests', 'req-status-update'), { status: 'sent' }, { merge: true }));
    });
    // 13b. Superadmin update rejected when disallowed fields are included
    it('rejects superadmin updating disallowed fields', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'mass_alert_requests', 'req-disallowed'), baseAlert('pending_ndrrmc_review'));
        });
        const db = authed(testEnv, 'super-1', staffClaims({ role: 'provincial_superadmin' }));
        await seedActiveAccount(testEnv, {
            uid: 'super-1',
            role: 'provincial_superadmin',
        });
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-disallowed'), {
            status: 'sent',
            requestedByUid: 'hacked', // ← disallowed field
        }, { merge: true }));
    });
    // 14. Extra field rejected - client injects unknown field
    it('denies extra field injection', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-extra'), {
            ...baseAlert('queued'),
            maliciousField: 'injected', // extra field not in allowlist
        }));
    });
    // 15. All required fields must exist - deny if required fields are missing
    it('denies missing required fields', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        // Only provide minimal fields - should fail
        await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-minimal'), {
            status: 'queued',
        }));
    });
    // 16. estimatedReach can be set - allow (it's in the allowlist)
    it('allows estimatedReach field', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(setDoc(doc(db, 'mass_alert_requests', 'req-reach'), {
            ...baseAlert('queued'),
            estimatedReach: 10000,
        }));
    });
    // 17. targetType must be valid - allow 'municipality'
    it('allows targetType municipality', async () => {
        const db = authed(testEnv, 'admin-uid', staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }));
        await assertSucceeds(setDoc(doc(db, 'mass_alert_requests', 'req-target'), {
            ...baseAlert('queued'),
            targetType: 'municipality',
        }));
    });
});
//# sourceMappingURL=mass-alert-requests.rules.test.js.map