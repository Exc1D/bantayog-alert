import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { withIdempotency } from '../../idempotency/guard.js';
import { adminDb } from '../../admin-init.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { checkRateLimit } from '../shared/rate-limit.js';
const subscribeSchema = z.object({
    token: z.string().min(1),
});
async function verifyTokenOwnership(db, uid, token) {
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists && userSnap.data()?.fcmToken === token) {
        return;
    }
    const responderSnap = await db.collection('responders').doc(uid).get();
    const tokens = responderSnap.data()?.fcmTokens;
    if (Array.isArray(tokens) && tokens.includes(token)) {
        return;
    }
    throw new HttpsError('permission-denied', 'Token does not belong to caller');
}
export async function subscribeToAlertsCore(db, deps) {
    const { token, actor, now } = deps;
    const rl = await checkRateLimit(db, {
        key: `subscribeToAlerts:${actor.uid}`,
        limit: 20,
        windowSeconds: 60,
        now,
    });
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', 'rate limit exceeded', {
            retryAfterSeconds: rl.retryAfterSeconds,
        });
    }
    await verifyTokenOwnership(db, actor.uid, token);
    const { result } = await withIdempotency(db, {
        key: `subscribeToAlerts:${actor.uid}:${token}`,
        payload: { token },
        now: () => now.toMillis(),
    }, async () => {
        // Import messaging dynamically to avoid loading unless needed
        const { messaging } = await import('firebase-admin');
        // Subscribe to the alerts topic
        await messaging().subscribeToTopic([token], 'alerts');
        return { success: true };
    });
    return result;
}
export const subscribeToAlerts = onCall({ region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in');
    }
    const parsed = subscribeSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    try {
        return await subscribeToAlertsCore(adminDb, {
            token: parsed.data.token,
            actor: { uid: request.auth.uid },
            now: Timestamp.now(),
        });
    }
    catch (error) {
        if (error instanceof HttpsError)
            throw error;
        console.error('Failed to subscribe to alerts topic:', error);
        throw new HttpsError('internal', 'Failed to subscribe to alerts');
    }
});
//# sourceMappingURL=subscribe-to-alerts.js.map