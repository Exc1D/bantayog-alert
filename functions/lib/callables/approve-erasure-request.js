import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth, requireMfaAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
export async function approveErasureRequestCore(db, input, actor) {
    const doc = await db.collection('erasure_requests').doc(input.erasureRequestId).get();
    if (!doc.exists) {
        throw new HttpsError('not-found', 'erasure_request_not_found');
    }
    const status = input.approved ? 'approved_pending_anonymization' : 'denied';
    await doc.ref.update({
        status,
        reviewedBy: actor.uid,
        reviewedAt: Date.now(),
        ...(input.reason ? { reviewReason: input.reason } : {}),
    });
    void streamAuditEvent({
        eventType: 'erasure_request_reviewed',
        actorUid: actor.uid,
        targetDocumentId: input.erasureRequestId,
        metadata: { approved: input.approved },
        occurredAt: Date.now(),
    });
}
export const approveErasureRequest = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['superadmin']);
    requireMfaAuth(request);
    await approveErasureRequestCore(getFirestore(), request.data, { uid });
});
//# sourceMappingURL=approve-erasure-request.js.map