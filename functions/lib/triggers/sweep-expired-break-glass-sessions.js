import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { streamAuditEvent } from '../services/audit-stream.js';
export const sweepExpiredBreakGlassSessions = onSchedule({ schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' }, async () => {
    const db = getFirestore();
    const adminAuth = getAuth();
    const now = Date.now();
    const snap = await db
        .collection('breakglass_events')
        .where('action', '==', 'initiated')
        .where('expiresAt', '<', now)
        .get();
    for (const doc of snap.docs) {
        const { actorUid, sessionId } = doc.data();
        try {
            const userRecord = await adminAuth.getUser(actorUid);
            const currentClaims = userRecord.customClaims ?? {};
            const remaining = {};
            for (const [key, value] of Object.entries(currentClaims)) {
                if (key !== 'breakGlassSession' &&
                    key !== 'breakGlassSessionId' &&
                    key !== 'breakGlassExpiresAt') {
                    remaining[key] = value;
                }
            }
            await adminAuth.setCustomUserClaims(actorUid, remaining);
            await doc.ref.update({ action: 'auto_expired', expiredAt: now });
            void streamAuditEvent({
                eventType: 'break_glass_auto_expired',
                actorUid,
                sessionId,
                occurredAt: now,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            console.error('[sweep-break-glass] failed for session', sessionId, {
                message,
                stack,
            });
        }
    }
});
//# sourceMappingURL=sweep-expired-break-glass-sessions.js.map