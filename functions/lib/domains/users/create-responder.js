import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators';
import { adminAuth, adminDb } from '../../admin-init.js';
import { withIdempotency } from '../../idempotency/guard.js';
import { checkRateLimit } from '../shared/rate-limit.js';
import { bantayogErrorToHttps, requireAuth } from '../shared/https-error.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { buildActiveAccountDoc, buildClaimRevocationDoc, buildStaffClaims, } from './custom-claims.js';
export const createResponderSchema = z
    .object({
    displayName: z.string().min(1).max(128),
    phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'phone must be E.164 format'),
    municipalityId: z.string().min(1).max(128).optional(),
    agencyId: z.string().min(1).max(128),
    specializations: z.array(z.string().min(1)).optional(),
    idempotencyKey: z.uuid(),
})
    .strict();
const log = logDimension('createResponder');
export async function createResponderCore(db, deps) {
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `createResponder:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: idempotentPayload,
        now: () => deps.now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `createResponder:${deps.actor.uid}`,
            limit: 10,
            windowSeconds: 60,
            now: deps.now,
        });
        if (!rl.allowed) {
            throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
                retryAfterSeconds: rl.retryAfterSeconds,
            });
        }
        // Verify caller agency matches payload agency.
        const callerAgencyId = deps.actor.claims.agencyId;
        if (callerAgencyId !== deps.agencyId) {
            throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'agencyId does not match caller');
        }
        // Check for existing phone to avoid auth collisions.
        try {
            const existing = await adminAuth.getUserByPhoneNumber(deps.phone);
            throw new BantayogError(BantayogErrorCode.CONFLICT, `Phone already in use by user ${existing.uid}`);
        }
        catch (err) {
            if (err instanceof BantayogError)
                throw err;
            const code = typeof err === 'object' && err !== null && 'code' in err
                ? err.code
                : undefined;
            if (code === 'auth/user-not-found') {
                // expected — continue
            }
            else if (code === 'auth/invalid-phone-number') {
                throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'invalid phone number format', { cause: err });
            }
            else {
                throw new BantayogError(BantayogErrorCode.INTERNAL_ERROR, 'auth lookup failed', {
                    cause: err,
                });
            }
        }
        const userRecord = await adminAuth.createUser({
            displayName: deps.displayName,
            phoneNumber: deps.phone,
        });
        const uid = userRecord.uid;
        const nowMs = deps.now.toMillis();
        const municipalityId = deps.municipalityId ?? deps.actor.claims.municipalityId;
        const claims = buildStaffClaims({
            uid,
            role: 'responder',
            municipalityId,
            agencyId: deps.agencyId,
            permittedMunicipalityIds: municipalityId ? [municipalityId] : [],
            mfaEnrolled: false,
        });
        await adminAuth.setCustomUserClaims(uid, claims);
        try {
            // eslint-disable-next-line @typescript-eslint/require-await
            await db.runTransaction(async (tx) => {
                const userRef = db.collection('users').doc(uid);
                tx.set(userRef, {
                    uid,
                    role: 'responder',
                    displayName: deps.displayName,
                    phone: deps.phone,
                    municipalityId: municipalityId ?? null,
                    agencyId: deps.agencyId,
                    status: 'active',
                    createdAt: nowMs,
                    updatedAt: nowMs,
                });
                tx.set(db.collection('active_accounts').doc(uid), buildActiveAccountDoc(uid, claims, nowMs));
                tx.set(db.collection('claim_revocations').doc(uid), buildClaimRevocationDoc(uid, nowMs, 'claims_updated'));
                const responderRef = db.collection('responders').doc(uid);
                tx.set(responderRef, {
                    uid,
                    agencyId: deps.agencyId,
                    municipalityId: municipalityId ?? null,
                    specializations: deps.specializations ?? [],
                    availabilityStatus: 'available',
                    isActive: true,
                    createdAt: nowMs,
                    updatedAt: nowMs,
                });
                const eventRef = db.collection('audit_events').doc();
                tx.set(eventRef, {
                    eventId: eventRef.id,
                    eventType: 'user_management',
                    actor: deps.actor.uid,
                    actorRole: deps.actor.claims.role ?? 'unknown',
                    targetUid: uid,
                    targetRole: 'responder',
                    action: 'created',
                    at: nowMs,
                    correlationId,
                    schemaVersion: 1,
                });
            });
        }
        catch (txErr) {
            try {
                await adminAuth.deleteUser(uid);
            }
            catch (deleteErr) {
                console.error('[createResponder] compensating delete failed:', deleteErr);
            }
            throw txErr;
        }
        log({
            severity: 'INFO',
            code: 'responder.created',
            message: `Responder ${uid} created under agency ${deps.agencyId}`,
            data: { uid, agencyId: deps.agencyId, actorUid: deps.actor.uid, correlationId },
        });
        return { uid, agencyId: deps.agencyId, availabilityStatus: 'available' };
    });
    return result;
}
export const createResponder = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
    timeoutSeconds: 15,
    memory: '512MiB',
    minInstances: 1,
}, async (request) => {
    const actor = requireAuth(request, ['agency_admin']);
    if (actor.claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    const parsed = createResponderSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        return await createResponderCore(adminDb, {
            displayName: parsed.data.displayName,
            phone: parsed.data.phone,
            ...(parsed.data.municipalityId !== undefined && {
                municipalityId: parsed.data.municipalityId,
            }),
            agencyId: parsed.data.agencyId,
            ...(parsed.data.specializations !== undefined && {
                specializations: parsed.data.specializations,
            }),
            idempotencyKey: parsed.data.idempotencyKey,
            actor,
            now: Timestamp.now(),
        });
    }
    catch (err) {
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
//# sourceMappingURL=create-responder.js.map