import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setStaffClaimsInputSchema, suspendStaffAccountInputSchema, } from '@bantayog/shared-validators';
import { adminAuth, adminDb } from '../../admin-init.js';
import { isAccountActive } from '../ops/admin-auth.js';
import { buildActiveAccountDoc, buildClaimRevocationDoc, buildStaffClaims, } from './custom-claims.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { getAdminCallableCorsOrigins } from '../shared/callable-config.js';
import { streamAuditEvent } from '../ops/audit-stream.js';
export const setStaffClaims = onCall({
    cors: getAdminCallableCorsOrigins(),
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
}, async (request) => {
    if (request.auth?.token.role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'Only superadmins can set staff claims.');
    }
    if (!isAccountActive(request.auth.token)) {
        throw new HttpsError('permission-denied', 'Account is not active.');
    }
    const parsed = setStaffClaimsInputSchema.parse(request.data);
    const claims = buildStaffClaims(parsed);
    const updatedAt = Date.now();
    const uid = parsed.uid;
    await adminAuth.setCustomUserClaims(uid, claims);
    const batch = adminDb.batch();
    batch.set(adminDb.collection('active_accounts').doc(uid), buildActiveAccountDoc(uid, claims, updatedAt));
    batch.set(adminDb.collection('claim_revocations').doc(uid), buildClaimRevocationDoc(uid, updatedAt, 'claims_updated'));
    await batch.commit();
    void streamAuditEvent({
        eventType: 'claims_set',
        actorUid: request.auth.uid,
        targetDocumentId: uid,
        metadata: { role: claims.role, municipalityId: claims.municipalityId },
        occurredAt: updatedAt,
    });
    return { uid, claims };
});
export const suspendStaffAccount = onCall({
    cors: getAdminCallableCorsOrigins(),
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
}, async (request) => {
    if (request.auth?.token.role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'Only superadmins can suspend accounts.');
    }
    if (!isAccountActive(request.auth.token)) {
        throw new HttpsError('permission-denied', 'Account is not active.');
    }
    const input = suspendStaffAccountInputSchema.parse(request.data);
    const snapshot = await adminDb.collection('active_accounts').doc(input.uid).get();
    if (!snapshot.exists) {
        throw new HttpsError('not-found', 'Active account record not found.');
    }
    const current = snapshot.data() ?? {};
    const revokedAt = Date.now();
    // Revoke Firebase Auth custom claims immediately — existing ID tokens
    // carry claims for up to 1 hour. Without this, suspended users can
    // still perform privileged operations until their token expires.
    await adminAuth.setCustomUserClaims(input.uid, {
        role: 'suspended',
        accountStatus: 'suspended',
    });
    await adminDb
        .collection('active_accounts')
        .doc(input.uid)
        .set({ ...current, accountStatus: 'suspended', updatedAt: revokedAt }, { merge: true });
    await adminDb
        .collection('claim_revocations')
        .doc(input.uid)
        .set(buildClaimRevocationDoc(input.uid, revokedAt, input.reason));
    return { uid: input.uid, status: 'suspended' };
});
//# sourceMappingURL=account-lifecycle.js.map