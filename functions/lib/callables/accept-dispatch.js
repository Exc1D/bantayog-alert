import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { bantayogErrorToHttps } from './https-error.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { shouldEnforceAppCheck } from './app-check-config.js';
import { isAccountActive } from './admin-auth.js';
import { mirrorDispatchStatusToReportInTransaction } from './dispatch-report-mirror.js';
export const acceptDispatchRequestSchema = z
    .object({
    dispatchId: z.string().min(1).max(128),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    idempotencyKey: z.string().uuid(),
})
    .strict();
export async function acceptDispatchCore(db, deps) {
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result, fromCache } = await withIdempotency(db, {
        key: `acceptDispatch:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: idempotentPayload,
        now: () => deps.now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `accept::${deps.actor.uid}`,
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
            const snap = await tx.get(dispatchRef);
            if (!snap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found');
            }
            const d = snap.data();
            // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
            if (d.assignedTo === undefined || d.assignedTo.uid !== deps.actor.uid) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Not assigned to this responder');
            }
            const assignedTo = d.assignedTo;
            if (d.status !== 'pending') {
                throw new BantayogError(BantayogErrorCode.CONFLICT, `Dispatch is no longer pending (current status: ${d.status})`);
            }
            const nowMillis = deps.now.toMillis();
            await mirrorDispatchStatusToReportInTransaction({
                db,
                tx,
                dispatchId: deps.dispatchId,
                reportId: d.reportId,
                afterStatus: 'accepted',
                actorUid: deps.actor.uid,
                actorRole: 'responder',
                nowMillis,
                correlationId,
            });
            tx.update(dispatchRef, {
                status: 'accepted',
                acceptedAt: nowMillis,
                lastStatusAt: nowMillis,
            });
            const agencyId = assignedTo.agencyId;
            const municipalityId = assignedTo.municipalityId;
            const evRef = db.collection('dispatch_events').doc();
            tx.set(evRef, {
                type: 'status_changed',
                dispatchId: deps.dispatchId,
                from: 'pending',
                to: 'accepted',
                actorUid: deps.actor.uid,
                actorRole: 'responder',
                agencyId,
                municipalityId,
                at: nowMillis,
                correlationId,
                schemaVersion: 1,
            });
            const deliveredRef = db.collection('dispatch_events').doc();
            tx.set(deliveredRef, {
                type: 'notification_delivered',
                dispatchId: deps.dispatchId,
                responderUid: deps.actor.uid,
                agencyId,
                municipalityId,
                action: 'accepted',
                at: nowMillis,
                correlationId,
                schemaVersion: 1,
            });
            return { status: 'accepted', dispatchId: deps.dispatchId };
        });
    });
    return { ...result, fromCache };
}
export const acceptDispatch = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    timeoutSeconds: 10,
    minInstances: 1,
    cors: ['http://localhost:5174', 'http://localhost:5175'],
}, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = request.auth.token;
    if (!claims)
        throw new HttpsError('unauthenticated', 'token required');
    if (claims.role !== 'responder') {
        throw new HttpsError('permission-denied', 'responder role required');
    }
    if (!isAccountActive(claims))
        throw new HttpsError('permission-denied', 'account is not active');
    const parsed = acceptDispatchRequestSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        const result = await acceptDispatchCore(adminDb, {
            dispatchId: parsed.data.dispatchId,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: { uid: request.auth.uid },
            now: Timestamp.now(),
        });
        return result;
    }
    catch (err) {
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
//# sourceMappingURL=accept-dispatch.js.map