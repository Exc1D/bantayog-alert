import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
export async function toggleMutualAidVisibilityCore(db, input, actor) {
    await db.collection('agencies').doc(input.agencyId).update({
        mutualAidVisible: input.visible,
    });
    void streamAuditEvent({
        eventType: 'mutual_aid_visibility_toggled',
        actorUid: actor.uid,
        targetCollection: 'agencies',
        targetDocumentId: input.agencyId,
        metadata: { visible: input.visible },
        occurredAt: Date.now(),
    });
}
export const toggleMutualAidVisibility = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['superadmin', 'pdrrmo']);
    await toggleMutualAidVisibilityCore(getFirestore(), request.data, { uid });
});
//# sourceMappingURL=toggle-mutual-aid-visibility.js.map