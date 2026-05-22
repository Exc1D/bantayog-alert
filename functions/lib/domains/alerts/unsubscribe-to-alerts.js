import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {} from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminDb } from '../../admin-init.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
const unsubscribeSchema = z.object({
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
export async function unsubscribeFromAlertsCore(db, deps) {
    await verifyTokenOwnership(db, deps.actor.uid, deps.token);
    const { messaging } = await import('firebase-admin');
    const response = await messaging().unsubscribeFromTopic([deps.token], 'alerts');
    if (response.failureCount > 0 && response.errors.length > 0) {
        const errors = response.errors
            .map((e) => (typeof e.error === 'string' ? e.error : JSON.stringify(e.error)))
            .join(', ');
        throw new Error(`Failed to unsubscribe from alerts topic: ${errors}`);
    }
    return { success: true };
}
export const unsubscribeFromAlerts = onCall({ region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in');
    }
    const parsed = unsubscribeSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    try {
        return await unsubscribeFromAlertsCore(adminDb, {
            token: parsed.data.token,
            actor: { uid: request.auth.uid },
        });
    }
    catch (error) {
        console.error('Failed to unsubscribe from alerts topic:', error);
        throw new HttpsError('internal', 'Failed to unsubscribe from alerts');
    }
});
//# sourceMappingURL=unsubscribe-to-alerts.js.map