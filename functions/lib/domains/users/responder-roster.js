import { onCall, HttpsError } from 'firebase-functions/v2/https';
// fallow-ignore-next-line code-duplication
import { Firestore, Timestamp, FieldPath } from 'firebase-admin/firestore';
// fallow-ignore-next-line code-duplication
import { z } from 'zod';
// fallow-ignore-next-line code-duplication
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators';
// fallow-ignore-next-line code-duplication
import { adminAuth, adminDb } from '../../admin-init.js';
// fallow-ignore-next-line code-duplication
import { withIdempotency } from '../../idempotency/guard.js';
// fallow-ignore-next-line code-duplication
import { checkRateLimit } from '../shared/rate-limit.js';
// fallow-ignore-next-line code-duplication
import { bantayogErrorToHttps, requireAuth } from '../shared/https-error.js';
// fallow-ignore-next-line code-duplication
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
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
function buildResponderStatusClaims(responder, targetStatus, nowMillis) {
    const municipalityId = typeof responder.municipalityId === 'string' && responder.municipalityId.length > 0
        ? responder.municipalityId
        : null;
    return {
        role: 'responder',
        accountStatus: targetStatus,
        ...(typeof responder.agencyId === 'string' && { agencyId: responder.agencyId }),
        ...(municipalityId && { municipalityId }),
        ...(municipalityId && { permittedMunicipalityIds: [municipalityId] }),
        mfaEnrolled: false,
        lastClaimIssuedAt: nowMillis,
    };
}
async function syncResponderAuthStatus(db, uid, targetStatus, nowMillis) {
    const responderSnap = await db.collection('responders').doc(uid).get();
    if (!responderSnap.exists) {
        throw new BantayogError(BantayogErrorCode.NOT_FOUND, `Responder '${uid}' not found`);
    }
    await adminAuth.setCustomUserClaims(uid, buildResponderStatusClaims(responderSnap.data(), targetStatus, nowMillis));
}
async function suspendOrRevokeResponderCore(db, deps) {
    const { uid, idempotencyKey, actor, now, targetStatus } = deps;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, targetStatus: _targetStatus, ...idempotentPayload } = deps;
    const nowMillis = now.toMillis();
    const { result } = await withIdempotency(db, {
        key: `${targetStatus}Responder:${actor.uid}:${idempotencyKey}`,
        payload: idempotentPayload,
        now: () => nowMillis,
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
    await syncResponderAuthStatus(db, uid, targetStatus, nowMillis);
    return result;
}
function createResponderStatusCallable(schema, targetStatus) {
    return onCall({
        region: 'asia-southeast1',
        enforceAppCheck: shouldEnforceAppCheck(),
        maxInstances: 10,
        timeoutSeconds: 10,
        minInstances: 1,
    }, async (request) => {
        const actor = requireAuth(request, ['agency_admin']);
        const actorClaims = actor.claims;
        if (actorClaims.accountStatus !== 'active') {
            throw new HttpsError('permission-denied', 'admin account not active');
        }
        const parsed = schema.safeParse(request.data);
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
                targetStatus,
            });
        }
        catch (err) {
            if (err instanceof BantayogError)
                throw bantayogErrorToHttps(err);
            throw err;
        }
    });
}
export const suspendResponder = createResponderStatusCallable(suspendResponderSchema, 'suspended');
export const revokeResponder = createResponderStatusCallable(revokeResponderSchema, 'revoked');
export async function bulkAvailabilityOverrideCore(db, deps) {
    const { uids, status, idempotencyKey, actor, now } = deps;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `bulkAvailabilityOverride:${actor.uid}:${idempotencyKey}`,
        payload: idempotentPayload,
        now: () => now.toMillis(),
    }, async () => {
        // fallow-ignore-next-line code-duplication
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
        const skippedUids = [];
        // Firestore 'in' queries support up to 10 values per chunk
        const CHUNK_SIZE = 10;
        for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
            const chunk = uids.slice(i, i + CHUNK_SIZE);
            const chunkSnap = await db
                .collection('responders')
                .where(FieldPath.documentId(), 'in', chunk)
                .get();
            const foundUids = new Set(chunkSnap.docs.map((d) => d.id));
            for (const uid of chunk) {
                if (!foundUids.has(uid)) {
                    skippedUids.push(uid);
                }
            }
            for (const doc of chunkSnap.docs) {
                const data = doc.data();
                if (data.agencyId !== actor.claims.agencyId) {
                    skippedUids.push(doc.id);
                    continue;
                }
                batch.update(doc.ref, {
                    availabilityStatus: status,
                    updatedAt: now.toMillis(),
                });
                updated++;
            }
        }
        if (skippedUids.length > 0) {
            throw new BantayogError(BantayogErrorCode.FORBIDDEN, `${String(skippedUids.length)} responder(s) not found or belong to a different agency`, {
                skippedUids,
            });
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
        return { updated, skipped: skippedUids.length, skippedUids };
    });
    return result;
}
// fallow-ignore-next-line code-duplication
export const bulkAvailabilityOverride = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
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