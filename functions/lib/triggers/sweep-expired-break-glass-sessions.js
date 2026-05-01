import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { streamAuditEvent } from '../services/audit-stream.js';
export async function sweepExpiredBreakGlassSessionsCore(input) {
    const now = input.now ? input.now() : Date.now();
    const result = { expired: 0, failed: 0 };
    const snap = await input.db
        .collection('breakglass_events')
        .where('action', '==', 'initiated')
        .where('expiresAt', '<', now)
        .get();
    for (const doc of snap.docs) {
        const data = doc.data();
        const actorUid = typeof data.actorUid === 'string' ? data.actorUid : undefined;
        const sessionId = typeof data.sessionId === 'string' ? data.sessionId : undefined;
        if (!actorUid || !sessionId) {
            console.error('[sweep-break-glass] malformed document', doc.id);
            result.failed++;
            continue;
        }
        try {
            const userRecord = await input.auth.getUser(actorUid);
            const currentClaims = userRecord.customClaims ?? {};
            const remaining = {};
            for (const [key, value] of Object.entries(currentClaims)) {
                if (key !== 'breakGlassSession' &&
                    key !== 'breakGlassSessionId' &&
                    key !== 'breakGlassExpiresAt') {
                    remaining[key] = value;
                }
            }
            await input.auth.setCustomUserClaims(actorUid, remaining);
            await doc.ref.update({ action: 'auto_expired', expiredAt: now });
            void streamAuditEvent({
                eventType: 'break_glass_auto_expired',
                actorUid,
                sessionId,
                occurredAt: now,
            });
            result.expired++;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error ? err.stack : undefined;
            console.error('[sweep-break-glass] failed for session', sessionId, {
                message,
                stack,
            });
            // Log, count failure, and CONTINUE to next session — one bad session must not block the sweep
            result.failed++;
            continue;
        }
    }
    return result;
}
export const sweepExpiredBreakGlassSessions = onSchedule({ schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' }, async () => {
    await sweepExpiredBreakGlassSessionsCore({
        db: getFirestore(),
        auth: getAuth(),
    });
});
//# sourceMappingURL=sweep-expired-break-glass-sessions.js.map