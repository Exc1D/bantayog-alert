import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators';
import { adminAuth, adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { bantayogErrorToHttps, requireAuth } from './https-error.js';
import { buildActiveAccountDoc, buildClaimRevocationDoc, buildStaffClaims, } from '../auth/custom-claims.js';
export const createUserSchema = z
    .object({
    displayName: z.string().min(1).max(128),
    phone: z.string().min(1).max(32),
    role: z.enum(['municipal_admin', 'agency_admin', 'responder', 'provincial_superadmin']),
    municipalityId: z.string().min(1).max(128).optional(),
    agencyId: z.string().min(1).max(128).optional(),
    specializations: z.array(z.string().min(1)).optional(),
    idempotencyKey: z.uuid(),
})
    .strict();
const log = logDimension('createUser');
export async function createUserCore(db, deps) {
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `createUser:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: idempotentPayload,
        now: () => deps.now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `createUser:${deps.actor.uid}`,
            limit: 10,
            windowSeconds: 60,
            now: deps.now,
        });
        if (!rl.allowed) {
            throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
                retryAfterSeconds: rl.retryAfterSeconds,
            });
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
            else {
                throw err;
            }
        }
        const userRecord = await adminAuth.createUser({
            displayName: deps.displayName,
            phoneNumber: deps.phone,
        });
        const uid = userRecord.uid;
        const nowMs = deps.now.toMillis();
        const claims = buildStaffClaims({
            uid,
            role: deps.role,
            municipalityId: deps.municipalityId,
            agencyId: deps.agencyId,
            permittedMunicipalityIds: deps.municipalityId ? [deps.municipalityId] : [],
            mfaEnrolled: false,
        });
        await adminAuth.setCustomUserClaims(uid, claims);
        try {
            // eslint-disable-next-line @typescript-eslint/require-await
            await db.runTransaction(async (tx) => {
                const userRef = db.collection('users').doc(uid);
                tx.set(userRef, {
                    uid,
                    role: deps.role,
                    displayName: deps.displayName,
                    phone: deps.phone,
                    municipalityId: deps.municipalityId ?? null,
                    agencyId: deps.agencyId ?? null,
                    status: 'active',
                    createdAt: nowMs,
                    updatedAt: nowMs,
                });
                tx.set(db.collection('active_accounts').doc(uid), buildActiveAccountDoc(uid, claims, nowMs));
                tx.set(db.collection('claim_revocations').doc(uid), buildClaimRevocationDoc(uid, nowMs, 'claims_updated'));
                const eventRef = db.collection('audit_events').doc();
                tx.set(eventRef, {
                    eventId: eventRef.id,
                    eventType: 'user_management',
                    actor: deps.actor.uid,
                    actorRole: deps.actor.claims.role ?? 'unknown',
                    targetUid: uid,
                    targetRole: deps.role,
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
                console.error('[createUser] compensating delete failed:', deleteErr);
            }
            throw txErr;
        }
        log({
            severity: 'INFO',
            code: 'user.created',
            message: `User ${uid} created with role ${deps.role}`,
            data: { uid, role: deps.role, actorUid: deps.actor.uid, correlationId },
        });
        return { uid, role: deps.role, accountStatus: 'active' };
    });
    return result;
}
export const createUser = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 15,
    minInstances: 1,
}, async (request) => {
    const actor = requireAuth(request, ['provincial_superadmin']);
    if (actor.claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    const parsed = createUserSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    if (parsed.data.role === 'municipal_admin' && !parsed.data.municipalityId) {
        throw new HttpsError('invalid-argument', 'missing municipalityId');
    }
    if ((parsed.data.role === 'agency_admin' || parsed.data.role === 'responder') &&
        !parsed.data.agencyId) {
        throw new HttpsError('invalid-argument', 'missing agencyId');
    }
    try {
        return await createUserCore(adminDb, {
            displayName: parsed.data.displayName,
            phone: parsed.data.phone,
            role: parsed.data.role,
            ...(parsed.data.municipalityId !== undefined && {
                municipalityId: parsed.data.municipalityId,
            }),
            ...(parsed.data.agencyId !== undefined && { agencyId: parsed.data.agencyId }),
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
//# sourceMappingURL=create-user.js.map