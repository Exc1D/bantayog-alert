import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../admin-init.js';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { bantayogErrorToHttps, requireAuth } from './https-error.js';
const ALLOWED_ROLES = new Set(['municipal_admin', 'agency_admin', 'provincial_superadmin']);
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
export async function enterFieldModeCore(db, deps) {
    const { actor, now } = deps;
    const nowMs = now.toMillis();
    if (!ALLOWED_ROLES.has(actor.claims.role) || actor.claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'admin role required');
    }
    // auth_time is Unix seconds; multiply by 1000 to compare with Date.now() (milliseconds)
    const authTimeMs = actor.claims.auth_time * 1000;
    if (nowMs - authTimeMs > FOUR_HOURS_MS) {
        throw new HttpsError('unauthenticated', 'Re-authentication required for field mode');
    }
    const expiresAt = nowMs + TWELVE_HOURS_MS;
    await db.collection('field_mode_sessions').doc(actor.uid).set({
        uid: actor.uid,
        municipalityId: actor.claims.municipalityId ?? '',
        enteredAt: nowMs,
        expiresAt,
        isActive: true,
        schemaVersion: 1,
    });
    return { status: 'entered', expiresAt };
}
export async function exitFieldModeCore(db, deps) {
    const { actor, now } = deps;
    const sessionRef = db.collection('field_mode_sessions').doc(actor.uid);
    const snap = await sessionRef.get();
    if (!snap.exists || !(snap.data()?.isActive === true)) {
        return { status: 'exited' }; // idempotent
    }
    await sessionRef.update({ isActive: false, exitedAt: now.toMillis() });
    return { status: 'exited' };
}
export const enterFieldMode = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
}, async (req) => {
    const actor = requireAuth(req, ['municipal_admin', 'agency_admin', 'provincial_superadmin']);
    // auth_time from Firebase token can be a number or string; coerce to number safely
    const rawAuthTime = req.auth?.token?.auth_time;
    const authTime = typeof rawAuthTime === 'number' && isFinite(rawAuthTime)
        ? rawAuthTime
        : 0;
    const claims = {
        role: actor.claims.role,
        accountStatus: actor.claims.accountStatus,
        municipalityId: actor.claims.municipalityId,
        auth_time: authTime,
    };
    try {
        return await enterFieldModeCore(adminDb, {
            actor: { uid: actor.uid, claims },
            now: Timestamp.now(),
        });
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
export const exitFieldMode = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
}, async (req) => {
    const actor = requireAuth(req, ['municipal_admin', 'agency_admin', 'provincial_superadmin']);
    // Reconstruct actor with same shape as enterFieldMode for consistency
    const shapedActor = {
        uid: actor.uid,
        claims: {
            role: actor.claims.role,
            accountStatus: actor.claims.accountStatus,
            municipalityId: actor.claims.municipalityId,
            auth_time: 0, // exitFieldModeCore doesn't use auth_time
        },
    };
    try {
        return await exitFieldModeCore(adminDb, {
            actor: shapedActor,
            now: Timestamp.now(),
        });
    }
    catch (err) {
        if (err instanceof HttpsError)
            throw err;
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
//# sourceMappingURL=enter-field-mode.js.map