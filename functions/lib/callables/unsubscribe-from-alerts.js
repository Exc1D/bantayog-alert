import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
const unsubscribeSchema = z.object({
    token: z.string().min(1),
});
export async function unsubscribeFromAlertsCore(deps) {
    const { messaging } = await import('firebase-admin');
    const response = await messaging().unsubscribeFromTopic([deps.token], 'alerts');
    if (response.failureCount > 0) {
        const errorDetails = response.errors && response.errors.length > 0
            ? ': ' + response.errors.map((e) => (typeof e.error === 'string' ? e.error : JSON.stringify(e.error))).join(', ')
            : ` (${response.failureCount} failure(s))`;
        throw new Error(`Failed to unsubscribe from alerts topic${errorDetails}`);
    }
    return { success: true };
}
export const unsubscribeFromAlerts = onCall({ region: 'asia-southeast1' }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Must be signed in');
    }
    const parsed = unsubscribeSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    try {
        return await unsubscribeFromAlertsCore({
            token: parsed.data.token,
            actor: { uid: request.auth.uid },
        });
    }
    catch (error) {
        console.error('Failed to unsubscribe from alerts topic:', error);
        throw new HttpsError('internal', 'Failed to unsubscribe from alerts');
    }
});
//# sourceMappingURL=unsubscribe-from-alerts.js.map