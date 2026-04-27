import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth, requireMfaAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
const ALLOWED_COLLECTIONS = ['reports', 'report_private', 'report_ops', 'sms_inbox'];
export async function setRetentionExemptCore(db, input, actor) {
    if (!ALLOWED_COLLECTIONS.includes(input.collection)) {
        throw new HttpsError('invalid-argument', 'collection_not_allowed');
    }
    await db.collection(input.collection).doc(input.documentId).update({
        retentionExempt: input.exempt,
        retentionExemptReason: input.reason,
        retentionExemptSetBy: actor.uid,
        retentionExemptSetAt: Date.now(),
    });
    void streamAuditEvent({
        eventType: 'retention_exempt_set',
        actorUid: actor.uid,
        targetCollection: input.collection,
        targetDocumentId: input.documentId,
        metadata: { exempt: input.exempt },
        occurredAt: Date.now(),
    });
}
export const setRetentionExempt = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['superadmin']);
    requireMfaAuth(request);
    await setRetentionExemptCore(getFirestore(), request.data, { uid });
});
//# sourceMappingURL=set-retention-exempt.js.map