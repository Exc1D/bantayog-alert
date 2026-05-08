import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { bantayogErrorToHttps, requireAuth } from './https-error.js';
export const requestProvincialEscalationSchema = z
    .object({
    dispatchId: z.string().min(1).max(128),
    reason: z.string().trim().min(1).max(500),
    notes: z.string().trim().min(1).max(2000).optional(),
    idempotencyKey: z.uuid(),
})
    .strict();
const log = logDimension('requestProvincialEscalation');
export async function requestProvincialEscalationCore(db, deps) {
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `requestProvincialEscalation:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: idempotentPayload,
        now: () => deps.now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `requestProvincialEscalation:${deps.actor.uid}`,
            limit: 30,
            windowSeconds: 60,
            now: deps.now,
        });
        if (!rl.allowed) {
            throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
                retryAfterSeconds: rl.retryAfterSeconds,
            });
        }
        return db.runTransaction(async (tx) => {
            const dispatchRef = db.collection('dispatches').doc(deps.dispatchId);
            const dispatchSnap = await tx.get(dispatchRef);
            if (!dispatchSnap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found');
            }
            const dispatch = dispatchSnap.data();
            if (dispatch.assignedTo?.uid !== deps.actor.uid) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Not assigned to this dispatch');
            }
            const activeStates = ['accepted', 'acknowledged', 'en_route', 'on_scene'];
            if (!activeStates.includes(dispatch.status)) {
                throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, `Dispatch must be active (current: ${dispatch.status})`);
            }
            const nowMs = deps.now.toMillis();
            const escalationRef = db.collection('escalation_requests').doc();
            const escalationId = escalationRef.id;
            tx.set(escalationRef, {
                escalationId,
                requesterUid: deps.actor.uid,
                dispatchId: deps.dispatchId,
                reportId: dispatch.reportId,
                reason: deps.reason,
                notes: deps.notes ?? null,
                status: 'pending',
                municipalityId: dispatch.assignedTo.municipalityId,
                agencyId: dispatch.assignedTo.agencyId,
                createdAt: nowMs,
                schemaVersion: 1,
            });
            // Notify superadmin via admin_notifications doc.
            tx.set(db.collection('admin_notifications').doc(), {
                type: 'provincial_escalation_requested',
                dispatchId: deps.dispatchId,
                escalationId,
                reportId: dispatch.reportId,
                responderUid: deps.actor.uid,
                agencyId: dispatch.assignedTo.agencyId,
                municipalityId: dispatch.assignedTo.municipalityId,
                reason: deps.reason,
                createdAt: nowMs,
                read: false,
                schemaVersion: 1,
            });
            const eventRef = db.collection('report_events').doc();
            tx.set(eventRef, {
                eventId: eventRef.id,
                eventType: 'escalation_requested',
                reportId: dispatch.reportId,
                actor: deps.actor.uid,
                actorRole: deps.actor.claims.role ?? 'responder',
                dispatchId: deps.dispatchId,
                escalationId,
                reason: deps.reason,
                at: nowMs,
                correlationId,
                schemaVersion: 1,
            });
            log({
                severity: 'INFO',
                code: 'escalation.requested',
                message: `Provincial escalation ${escalationId} requested for dispatch ${deps.dispatchId}`,
                data: {
                    escalationId,
                    dispatchId: deps.dispatchId,
                    reportId: dispatch.reportId,
                    actorUid: deps.actor.uid,
                    correlationId,
                },
            });
            return { escalationId, status: 'pending' };
        });
    });
    return result;
}
export const requestProvincialEscalation = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
}, async (request) => {
    const actor = requireAuth(request, ['responder']);
    if (actor.claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    const parsed = requestProvincialEscalationSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        return await requestProvincialEscalationCore(adminDb, {
            dispatchId: parsed.data.dispatchId,
            reason: parsed.data.reason,
            ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: actor.uid,
                claims: {
                    ...(typeof actor.claims.role === 'string' && { role: actor.claims.role }),
                    ...(typeof actor.claims.agencyId === 'string' && { agencyId: actor.claims.agencyId }),
                },
            },
            now: Timestamp.now(),
        });
    }
    catch (err) {
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
//# sourceMappingURL=request-provincial-escalation.js.map