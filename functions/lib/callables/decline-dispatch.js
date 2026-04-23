import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '../admin-init.js';
import { BantayogError, BantayogErrorCode, invalidTransitionError, } from '@bantayog/shared-validators';
import { IdempotencyMismatchError, withIdempotency } from '../idempotency/guard.js';
import { bantayogErrorToHttps, requireAuth } from './https-error.js';
import { checkRateLimit } from '../services/rate-limit.js';
export const declineDispatchRequestSchema = z
    .object({
    dispatchId: z.string().min(1).max(128),
    declineReason: z.string().trim().min(1).max(200),
    idempotencyKey: z.uuid(),
})
    .strict();
function hasValidAssignedResponder(assignedTo) {
    if (!assignedTo || typeof assignedTo !== 'object') {
        return false;
    }
    const candidate = assignedTo;
    return (typeof candidate.uid === 'string' &&
        candidate.uid.length > 0 &&
        typeof candidate.agencyId === 'string' &&
        candidate.agencyId.length > 0 &&
        typeof candidate.municipalityId === 'string' &&
        candidate.municipalityId.length > 0);
}
export async function declineDispatchCore(db, deps) {
    const { dispatchId, declineReason, idempotencyKey, actor, now } = deps;
    const normalizedDeclineReason = declineReason.trim();
    if (!normalizedDeclineReason) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'declineReason required');
    }
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = {
        ...deps,
        declineReason: normalizedDeclineReason,
    };
    const { result } = await withIdempotency(db, {
        key: `declineDispatch:${actor.uid}:${idempotencyKey}`,
        payload: idempotentPayload,
        now: () => now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `decline::${actor.uid}`,
            limit: 30,
            windowSeconds: 60,
            now,
            updatedAt: now.toMillis(),
        });
        if (!rl.allowed) {
            throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
                retryAfterSeconds: rl.retryAfterSeconds,
            });
        }
        return db.runTransaction(async (transaction) => {
            const dispatchRef = db.collection('dispatches').doc(dispatchId);
            const dispatchSnap = await transaction.get(dispatchRef);
            if (!dispatchSnap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found');
            }
            const dispatch = dispatchSnap.data();
            const assignedTo = hasValidAssignedResponder(dispatch.assignedTo)
                ? dispatch
                    .assignedTo
                : null;
            if (actor.claims.role !== 'responder' || assignedTo?.uid !== actor.uid) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Only assigned responder can decline');
            }
            if (dispatch.status !== 'pending') {
                throw invalidTransitionError(dispatch.status, 'declined', {
                    code: BantayogErrorCode.INVALID_STATUS_TRANSITION,
                });
            }
            transaction.update(dispatchRef, {
                status: 'declined',
                declineReason: normalizedDeclineReason,
                statusUpdatedAt: now.toMillis(),
                lastStatusAt: now.toMillis(),
            });
            transaction.set(db.collection('dispatch_events').doc(), {
                dispatchId,
                reportId: dispatch.reportId,
                actor: actor.uid,
                actorRole: actor.claims.role,
                fromStatus: dispatch.status,
                toStatus: 'declined',
                reason: normalizedDeclineReason,
                createdAt: now.toMillis(),
                correlationId,
                schemaVersion: 1,
                agencyId: assignedTo.agencyId,
                municipalityId: assignedTo.municipalityId,
            });
            return { status: 'declined' };
        });
    });
    return result;
}
export async function declineDispatchHandler(request) {
    const actor = requireAuth(request, ['responder']);
    if (actor.claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    const parsed = declineDispatchRequestSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        return await declineDispatchCore(adminDb, {
            dispatchId: parsed.data.dispatchId,
            declineReason: parsed.data.declineReason,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: actor.uid,
                claims: actor.claims,
            },
            now: Timestamp.now(),
        });
    }
    catch (error) {
        if (error instanceof BantayogError) {
            throw bantayogErrorToHttps(error);
        }
        if (error instanceof IdempotencyMismatchError) {
            throw new HttpsError('already-exists', 'duplicate request with different payload');
        }
        throw error;
    }
}
export const declineDispatch = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
}, declineDispatchHandler);
//# sourceMappingURL=decline-dispatch.js.map