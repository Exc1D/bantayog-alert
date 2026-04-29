import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAuth, requireMfaAuth } from './https-error.js';
import { streamAuditEvent } from '../services/audit-stream.js';
const inputSchema = z.object({
    erasureRequestId: z.string().min(1),
    hold: z.boolean(),
    reason: z.string().min(1).max(1000),
});
const TERMINAL_STATUSES = new Set(['completed', 'denied', 'dead_lettered']);
export async function setErasureLegalHoldCore(db, input, actor) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'invalid_legal_hold_payload');
    }
    const data = parsed.data;
    const ref = db.collection('erasure_requests').doc(data.erasureRequestId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new HttpsError('not-found', 'erasure_request_not_found');
        const status = snap.data()?.status;
        if (TERMINAL_STATUSES.has(status)) {
            throw new HttpsError('failed-precondition', 'cannot_hold_terminal_request');
        }
        tx.update(ref, {
            legalHold: data.hold,
            legalHoldReason: data.reason,
            legalHoldSetBy: actor.uid,
        });
    });
    void streamAuditEvent({
        eventType: data.hold ? 'erasure_legal_hold_set' : 'erasure_legal_hold_cleared',
        actorUid: actor.uid,
        targetDocumentId: data.erasureRequestId,
        metadata: { hold: data.hold, reason: data.reason },
        occurredAt: Date.now(),
    });
}
export const setErasureLegalHold = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['superadmin']);
    requireMfaAuth(request);
    await setErasureLegalHoldCore(getFirestore(), request.data, { uid });
});
//# sourceMappingURL=set-erasure-legal-hold.js.map