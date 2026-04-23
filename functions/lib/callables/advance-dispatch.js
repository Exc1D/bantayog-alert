import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '../admin-init.js';
import { advanceDispatchRequestSchema, BantayogError, BantayogErrorCode, invalidTransitionError, } from '@bantayog/shared-validators';
import { withIdempotency } from '../idempotency/guard.js';
import { requireAuth, bantayogErrorToHttps } from './https-error.js';
export const advanceDispatchCore = async (db, req) => {
    const { dispatchId, to, resolutionSummary, idempotencyKey, actor, now } = req;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = req;
    const { result } = await withIdempotency(db, {
        key: `advanceDispatch:${actor.uid}:${idempotencyKey}`,
        payload: idempotentPayload,
        now: () => now.toMillis(),
    }, async () => db.runTransaction(async (transaction) => {
        const dispatchRef = db.collection('dispatches').doc(dispatchId);
        const dispatchSnap = await transaction.get(dispatchRef);
        if (!dispatchSnap.exists) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found');
        }
        const dispatch = dispatchSnap.data();
        // Access control
        if (actor.claims.role !== 'responder' || dispatch.assignedTo.uid !== actor.uid) {
            throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Only assigned responder can advance');
        }
        const from = dispatch.status;
        // Valid transitions
        const validTransitions = {
            accepted: ['acknowledged'],
            acknowledged: ['en_route'],
            en_route: ['on_scene'],
            on_scene: ['resolved'],
        };
        if (!validTransitions[from]?.includes(to)) {
            throw invalidTransitionError(from, to, {
                code: BantayogErrorCode.INVALID_STATUS_TRANSITION,
            });
        }
        if (to === 'resolved' && !resolutionSummary) {
            throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'resolutionSummary required');
        }
        const patch = {
            status: to,
            statusUpdatedAt: now.toMillis(),
            lastStatusAt: now,
        };
        if (to === 'acknowledged')
            patch.acknowledgedAt = now.toMillis();
        if (to === 'en_route')
            patch.enRouteAt = now.toMillis();
        if (to === 'on_scene')
            patch.onSceneAt = now.toMillis();
        if (to === 'resolved') {
            patch.resolvedAt = now.toMillis();
            patch.resolutionSummary = resolutionSummary;
        }
        transaction.update(dispatchRef, patch);
        const evRef = db.collection('dispatch_events').doc();
        transaction.set(evRef, {
            dispatchId,
            from,
            to,
            actorUid: actor.uid,
            actorRole: actor.claims.role,
            createdAt: now.toMillis(),
        });
        return { status: to };
    }));
    return result;
};
export const advanceDispatch = onCall({ enforceAppCheck: true, consumeAppCheckToken: false }, async (request) => {
    const actor = requireAuth(request, ['responder']);
    try {
        const data = advanceDispatchRequestSchema.parse(request.data);
        return await advanceDispatchCore(adminDb, {
            ...data,
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
        if (error instanceof z.ZodError) {
            throw new HttpsError('invalid-argument', error.issues[0]?.message ?? 'Invalid argument');
        }
        throw error;
    }
});
//# sourceMappingURL=advance-dispatch.js.map