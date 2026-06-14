import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CAMARINES_NORTE_MUNICIPALITIES, updateMunicipalityContactInputSchema, } from '@bantayog/shared-validators';
import { adminDb } from '../../admin-init.js';
import { PROVINCIAL_SUPERADMIN } from '../../constants/roles.js';
import { requireAuth } from '../shared/https-error.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { getAdminCallableCorsOrigins } from '../shared/callable-config.js';
import { checkRateLimit } from '../shared/rate-limit.js';
import { streamAuditEvent } from './audit-stream.js';
/**
 * Provincial superadmins edit any municipality's MDRRMO contact card; a
 * municipal admin may only edit their own jurisdiction. Citizens see these
 * fields live on the post-submission RevealSheet and SMS/hotline fallbacks.
 */
function assertActorCanEditContact(deps) {
    const { role, municipalityId } = deps.actor.claims;
    if (role === PROVINCIAL_SUPERADMIN)
        return;
    if (role !== 'municipal_admin') {
        throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required');
    }
    if (!municipalityId) {
        throw new HttpsError('permission-denied', 'municipality scope required');
    }
    if (municipalityId !== deps.municipalityId) {
        throw new HttpsError('permission-denied', 'municipality not in your jurisdiction');
    }
}
export async function updateMunicipalityContactCore(db, deps) {
    assertActorCanEditContact(deps);
    const ref = db.collection('municipalities').doc(deps.municipalityId);
    const snap = await ref.get();
    if (!snap.exists) {
        const municipality = CAMARINES_NORTE_MUNICIPALITIES.find((m) => m.id === deps.municipalityId);
        if (!municipality) {
            throw new HttpsError('not-found', 'municipality not found');
        }
        await ref.set({
            ...municipality,
            schemaVersion: 1,
        });
    }
    await ref.update({
        mdrrmoLabel: deps.mdrrmoLabel,
        mdrrmoHotline: deps.mdrrmoHotline,
        contactUpdatedAt: deps.now,
        contactUpdatedBy: deps.actor.uid,
    });
    void streamAuditEvent({
        eventType: 'municipality_contact_updated',
        actorUid: deps.actor.uid,
        targetCollection: 'municipalities',
        targetDocumentId: deps.municipalityId,
        metadata: {
            mdrrmoLabel: deps.mdrrmoLabel,
            mdrrmoHotline: deps.mdrrmoHotline,
            ...(deps.actor.claims.role ? { actorRole: deps.actor.claims.role } : {}),
        },
        occurredAt: deps.now,
    });
    return {
        municipalityId: deps.municipalityId,
        mdrrmoLabel: deps.mdrrmoLabel,
        mdrrmoHotline: deps.mdrrmoHotline,
        updatedAt: deps.now,
    };
}
export const updateMunicipalityContact = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
    cors: getAdminCallableCorsOrigins(),
}, async (request) => {
    const { uid, claims } = requireAuth(request, [PROVINCIAL_SUPERADMIN, 'municipal_admin']);
    const parsed = updateMunicipalityContactInputSchema.safeParse(request.data);
    if (!parsed.success) {
        console.error('updateMunicipalityContact validation failed:', z.treeifyError(parsed.error));
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    const rl = await checkRateLimit(getFirestore(), {
        key: `updateMunicipalityContact:${uid}`,
        limit: 10,
        windowSeconds: 60,
        now: Timestamp.now(),
    });
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', 'rate limit', {
            retryAfterSeconds: rl.retryAfterSeconds,
        });
    }
    const actorClaims = {
        ...(typeof claims.role === 'string' ? { role: claims.role } : {}),
        ...(typeof claims.municipalityId === 'string'
            ? { municipalityId: claims.municipalityId }
            : {}),
    };
    return updateMunicipalityContactCore(adminDb, {
        municipalityId: parsed.data.municipalityId,
        mdrrmoLabel: parsed.data.mdrrmoLabel,
        mdrrmoHotline: parsed.data.mdrrmoHotline,
        actor: { uid, claims: actorClaims },
        now: Date.now(),
    });
});
//# sourceMappingURL=update-municipality-contact.js.map