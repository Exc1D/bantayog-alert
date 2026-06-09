import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { adminDb } from '../../admin-init.js';
import { withIdempotency } from '../../idempotency/guard.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { sendFcmToResponder } from '../ops/fcm-send.js';
const InputSchema = z
    .object({
    dispatchId: z.string().min(1).max(128),
    newResponderUid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
})
    .strict();
function mapFcmResult(fcm) {
    if (fcm.warnings.includes('fcm_no_token'))
        return 'no_token';
    if (fcm.warnings.includes('fcm_network_error'))
        return 'network_error';
    if (fcm.warnings.length > 0)
        return 'sent_with_invalid_tokens';
    return 'sent';
}
export async function escalateDispatchCore(db, deps) {
    const correlationId = crypto.randomUUID();
    const parsed = InputSchema.parse({
        dispatchId: deps.dispatchId,
        newResponderUid: deps.newResponderUid,
        idempotencyKey: deps.idempotencyKey,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `escalateDispatch:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: idempotentPayload,
        now: () => deps.now.toMillis(),
    }, async () => db.runTransaction(async (tx) => {
        const dispatchRef = db.collection('dispatches').doc(parsed.dispatchId);
        const dispatchSnap = await tx.get(dispatchRef);
        if (!dispatchSnap.exists) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found');
        }
        const dispatch = dispatchSnap.data();
        // Authz: municipal_admin can only escalate in their municipality
        // provincial_superadmin can escalate anywhere
        const role = deps.actor.claims.role;
        const municipalityId = dispatch.municipalityId;
        if (role === 'municipal_admin') {
            const adminMuni = deps.actor.claims.municipalityId;
            if (municipalityId !== adminMuni) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'not your municipality');
            }
        }
        else if (role === 'provincial_superadmin') {
            // superadmin can escalate any dispatch
        }
        else {
            throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'admin required');
        }
        // Verify new responder is active
        const responderRef = db.collection('responders').doc(parsed.newResponderUid);
        const responderSnap = await tx.get(responderRef);
        if (!responderSnap.exists) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'responder not found');
        }
        const responder = responderSnap.data();
        if (responder.accountStatus !== 'active') {
            throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'responder is not active');
        }
        // Exclude previously notified
        const previouslyNotified = new Set(dispatch.previouslyNotifiedResponderUids ?? []);
        if (previouslyNotified.has(parsed.newResponderUid)) {
            throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, 'responder already notified');
        }
        const currentEscalationCount = typeof dispatch.escalationCount === 'number' ? dispatch.escalationCount : 0;
        const previousResponderUid = dispatch.assignedTo?.uid ?? '';
        const previouslyNotifiedResponderUids = Array.from(new Set(previousResponderUid
            ? [...(dispatch.previouslyNotifiedResponderUids ?? []), previousResponderUid]
            : (dispatch.previouslyNotifiedResponderUids ?? [])));
        tx.update(dispatchRef, {
            assignedTo: {
                uid: parsed.newResponderUid,
                agencyId: responder.agencyId,
                municipalityId: responder.municipalityId,
            },
            escalationCount: currentEscalationCount + 1,
            previouslyNotifiedResponderUids,
            escalationReason: 'admin_override',
            monitorLeaseAt: deps.now.toMillis(),
            status: 'pending',
        });
        tx.set(db.collection('dispatch_events').doc(), {
            type: 'escalation_attempted',
            dispatchId: parsed.dispatchId,
            fromResponderUid: dispatch.assignedTo?.uid ?? '',
            toResponderUid: parsed.newResponderUid,
            agencyId: responder.agencyId,
            municipalityId: responder.municipalityId,
            reason: 'admin_override',
            at: deps.now.toMillis(),
            correlationId,
            schemaVersion: 1,
        });
        return {
            dispatchId: parsed.dispatchId,
            status: 'pending',
            reportId: dispatch.reportId ?? '',
            responder: {
                agencyId: responder.agencyId,
                municipalityId: responder.municipalityId,
            },
            correlationId,
        };
    }));
    const fcm = await sendFcmToResponder({
        uid: parsed.newResponderUid,
        title: 'Dispatch escalated',
        body: `Report ${result.reportId.slice(0, 8)} — see app for details`,
        data: {
            dispatchId: result.dispatchId,
            reportId: result.reportId,
            correlationId: result.correlationId,
        },
    });
    const fcmResult = mapFcmResult(fcm);
    const nowMillis = deps.now.toMillis();
    await db.collection('dispatch_events').add({
        type: 'notification_attempted',
        dispatchId: result.dispatchId,
        responderUid: parsed.newResponderUid,
        agencyId: result.responder.agencyId,
        municipalityId: result.responder.municipalityId,
        fcmResult,
        fcmWarnings: fcm.warnings,
        at: nowMillis,
        correlationId: result.correlationId,
        schemaVersion: 1,
    });
    await db.collection('dispatches').doc(result.dispatchId).update({
        fcmResult,
        fcmWarnings: fcm.warnings,
    });
    if (fcmResult === 'network_error') {
        await db.collection('fcm_retry_queue').add({
            dispatchId: result.dispatchId,
            responderUid: parsed.newResponderUid,
            attemptCount: 0,
            lastAttemptAt: nowMillis,
            nextAttemptAt: nowMillis + 30_000,
            originalError: 'fcm_network_error',
            status: 'pending',
        });
    }
    return {
        ...result,
        fcmResult,
        fcmWarnings: fcm.warnings,
    };
}
export const escalateDispatch = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 100,
}, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = req.auth.token;
    if (!claims)
        throw new HttpsError('unauthenticated', 'token required');
    const role = claims.role;
    if (role !== 'municipal_admin' && role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'admin required');
    }
    if (claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account not active');
    }
    const parsed = InputSchema.safeParse(req.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    return await escalateDispatchCore(adminDb, {
        dispatchId: parsed.data.dispatchId,
        newResponderUid: parsed.data.newResponderUid,
        idempotencyKey: parsed.data.idempotencyKey,
        actor: {
            uid: req.auth.uid,
            claims: {
                role: claims.role,
                municipalityId: claims.municipalityId,
            },
        },
        now: Timestamp.now(),
    });
});
//# sourceMappingURL=escalate-dispatch.js.map