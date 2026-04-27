import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp, FieldPath } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { bantayogErrorToHttps, requireAuth } from './https-error.js';
import { checkRateLimit } from '../services/rate-limit.js';
const log = logDimension('responderRoster');
const suspendResponderSchema = z
    .object({
    uid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
})
    .strict();
const revokeResponderSchema = z
    .object({
    uid: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
})
    .strict();
const AVAILABILITY_STATUSES = ['available', 'unavailable', 'off_duty'];
const bulkAvailabilityOverrideSchema = z
    .object({
    uids: z.array(z.string().min(1).max(128)).min(1).max(50),
    status: z.enum(AVAILABILITY_STATUSES),
    idempotencyKey: z.uuid(),
})
    .strict();
async function suspendOrRevokeResponderCore(db, deps) {
    const { uid, idempotencyKey, actor, now, targetStatus } = deps;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, targetStatus: _targetStatus, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `${targetStatus}Responder:${actor.uid}:${idempotencyKey}`,
        payload: idempotentPayload,
        now: () => now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `${targetStatus}Responder:${actor.uid}`,
            limit: 60,
            windowSeconds: 60,
            now,
        });
        if (!rl.allowed) {
            throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
                retryAfterSeconds: rl.retryAfterSeconds,
            });
        }
        return db.runTransaction(async (tx) => {
            const responderRef = db.collection('responders').doc(uid);
            const responderSnap = await tx.get(responderRef);
            if (!responderSnap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, `Responder '${uid}' not found`);
            }
            const responder = responderSnap.data();
            if (responder.agencyId !== actor.claims.agencyId) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Responder belongs to a different agency');
            }
            if (responder.accountStatus === targetStatus) {
                return { uid, status: targetStatus };
            }
            tx.update(responderRef, {
                accountStatus: targetStatus,
                availabilityStatus: 'off_duty',
                updatedAt: now.toMillis(),
            });
            log({
                severity: 'INFO',
                code: 'responder.status_changed',
                message: `Responder ${uid} status changed to ${targetStatus}`,
                data: {
                    uid,
                    fromStatus: responder.accountStatus,
                    toStatus: targetStatus,
                    actorUid: actor.uid,
                },
            });
            return { uid, status: targetStatus };
        });
    });
    return result;
}
export const suspendResponder = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
}, async (request) => {
    const actor = requireAuth(request, ['agency_admin']);
    const actorClaims = actor.claims;
    if (actorClaims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'admin account not active');
    }
    const parsed = suspendResponderSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        return await suspendOrRevokeResponderCore(adminDb, {
            uid: parsed.data.uid,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: actor.uid,
                claims: actorClaims,
            },
            now: Timestamp.now(),
            targetStatus: 'suspended',
        });
    }
    catch (err) {
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
export const revokeResponder = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
}, async (request) => {
    const actor = requireAuth(request, ['agency_admin']);
    const actorClaims = actor.claims;
    if (actorClaims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'admin account not active');
    }
    const parsed = revokeResponderSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        return await suspendOrRevokeResponderCore(adminDb, {
            uid: parsed.data.uid,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: actor.uid,
                claims: actorClaims,
            },
            now: Timestamp.now(),
            targetStatus: 'revoked',
        });
    }
    catch (err) {
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
export async function bulkAvailabilityOverrideCore(db, deps) {
    const { uids, status, idempotencyKey, actor, now } = deps;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `bulkAvailabilityOverride:${actor.uid}:${idempotencyKey}`,
        payload: idempotentPayload,
        now: () => now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `bulkAvailabilityOverride:${actor.uid}`,
            limit: 5,
            windowSeconds: 60,
            now,
        });
        if (!rl.allowed) {
            throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
                retryAfterSeconds: rl.retryAfterSeconds,
            });
        }
        const batch = db.batch();
        let updated = 0;
        // Firestore 'in' queries support up to 10 values per chunk
        const CHUNK_SIZE = 10;
        for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
            const chunk = uids.slice(i, i + CHUNK_SIZE);
            const chunkSnap = await db
                .collection('responders')
                .where(FieldPath.documentId(), 'in', chunk)
                .get();
            for (const doc of chunkSnap.docs) {
                const data = doc.data();
                if (data.agencyId !== actor.claims.agencyId)
                    continue;
                batch.update(doc.ref, {
                    availabilityStatus: status,
                    updatedAt: now.toMillis(),
                });
                updated++;
            }
        }
        await batch.commit();
        log({
            severity: 'INFO',
            code: 'responder.bulk_availability_override',
            message: `Bulk availability override updated ${String(updated)} responders`,
            data: {
                requested: uids.length,
                updated,
                status,
                actorUid: actor.uid,
            },
        });
        return { updated };
    });
    return result;
}
export const bulkAvailabilityOverride = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
}, async (request) => {
    const actor = requireAuth(request, ['agency_admin']);
    const actorClaims = actor.claims;
    if (actorClaims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'admin account not active');
    }
    const parsed = bulkAvailabilityOverrideSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        return await bulkAvailabilityOverrideCore(adminDb, {
            uids: parsed.data.uids,
            status: parsed.data.status,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: actor.uid,
                claims: actorClaims,
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
//# sourceMappingURL=responder-roster.js.map