import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAuth, requireMfaAuth } from '../shared/https-error.js';
import { PRIVILEGED_ROLES } from '../../constants/roles.js';
import { RETENTION_EXEMPT_COLLECTIONS } from '../../constants/retention.js';
import { streamAuditEvent } from '../ops/audit-stream.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
const inputSchema = z.object({
    collection: z.enum(RETENTION_EXEMPT_COLLECTIONS),
    documentId: z.string().min(1),
    exempt: z.boolean(),
    reason: z.string().min(1),
});
export async function setRetentionExemptCore(db, input, actor) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'invalid_retention_exempt_payload');
    }
    const data = parsed.data;
    const docRef = db.collection(data.collection).doc(data.documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        throw new HttpsError('not-found', 'document_not_found');
    }
    const docData = docSnap.data();
    const docMunicipalityId = docData.municipalityId;
    if (!docMunicipalityId || !actor.permittedMunicipalityIds.includes(docMunicipalityId)) {
        throw new HttpsError('permission-denied', 'municipality_not_permitted');
    }
    await docRef.update({
        retentionExempt: data.exempt,
        retentionExemptReason: data.reason,
        retentionExemptSetBy: actor.uid,
        retentionExemptSetAt: Date.now(),
    });
    void streamAuditEvent({
        eventType: 'retention_exempt_set',
        actorUid: actor.uid,
        targetCollection: data.collection,
        targetDocumentId: data.documentId,
        metadata: { exempt: data.exempt },
        occurredAt: Date.now(),
    });
}
export const setRetentionExempt = onCall({ region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
    const { uid, claims } = requireAuth(request, PRIVILEGED_ROLES);
    requireMfaAuth(request);
    const permittedMunicipalityIds = Array.isArray(claims.permittedMunicipalityIds)
        ? claims.permittedMunicipalityIds.filter((v) => typeof v === 'string')
        : [];
    await setRetentionExemptCore(getFirestore(), request.data, { uid, permittedMunicipalityIds });
});
//# sourceMappingURL=set-retention-exempt.js.map