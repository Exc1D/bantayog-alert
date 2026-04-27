import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
const inputSchema = z.object({
    agencyId: z.string().min(1),
    visible: z.boolean(),
});
export async function toggleMutualAidVisibilityCore(db, input, actor) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'invalid_toggle_mutual_aid_visibility_payload');
    }
    const { agencyId, visible } = parsed.data;
    const agencyRef = db.collection('agencies').doc(agencyId);
    const agencyDoc = await agencyRef.get();
    if (!agencyDoc.exists) {
        throw new HttpsError('not-found', 'agency_not_found');
    }
    await agencyRef.update({
        mutualAidVisible: visible,
    });
    void streamAuditEvent({
        eventType: 'mutual_aid_visibility_toggled',
        actorUid: actor.uid,
        targetCollection: 'agencies',
        targetDocumentId: agencyId,
        metadata: { visible },
        occurredAt: Date.now(),
    });
}
export const toggleMutualAidVisibility = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['superadmin', 'pdrrmo']);
    await toggleMutualAidVisibilityCore(getFirestore(), request.data, { uid });
});
//# sourceMappingURL=toggle-mutual-aid-visibility.js.map